document.addEventListener('DOMContentLoaded', async () => {
    // Get references to DOM elements
    const copyAllTabsBtn = document.getElementById('copyAllTabsBtn');
    const pasteAndOpenBtn = document.getElementById('pasteAndOpenBtn');
    const saveCurrentCopyBtn = document.getElementById('saveCurrentCopyBtn');
    const messageBox = document.getElementById('messageBox');
    const savedTabsList = document.getElementById('savedTabsList');
    const noSavedTabsMessage = document.getElementById('noSavedTabsMessage');

    // Inline save elements (formerly modal elements)
    const saveNameInput = document.getElementById('saveNameInput');
    const confirmSaveNameBtn = document.getElementById('confirmSaveNameBtn');

    let tabsToSave = []; // Temporarily store tabs copied for saving

    // Function to show a temporary message in the message box
    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`; // Add type for potential styling (e.g., success, error)
        messageBox.classList.remove('hidden');
        setTimeout(() => {
            messageBox.classList.add('hidden');
            messageBox.textContent = '';
        }, 3000); // Hide after 3 seconds
    }

    // Function to copy text to clipboard
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showMessage('Successfully Copied!', 'success');
            // Also display a Chrome notification
            chrome.notifications.create({
                type: 'basic',
                // Using a 1x1 transparent GIF to satisfy the mandatory iconUrl requirement without displaying a visible icon.
                iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                title: 'Tab URL Manager',
                message: 'URLs copied to clipboard!'
            });
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showMessage('Failed to copy.', 'error');
            // Fallback for older browsers or restricted environments
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showMessage('Successfully Copied (fallback)!', 'success');
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                    title: 'Tab URL Manager',
                    message: 'URLs copied to clipboard (fallback)!'
                });
            } catch (execErr) {
                console.error('Fallback copy failed: ', execErr);
                showMessage('Failed to copy (fallback). Please copy manually.', 'error');
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    // Function to format URLs as plain URLs only
    function formatUrlsOnly(tabs) {
        return tabs.map(tab => tab.url).join('\n');
    }

    // Event listener for "Copy All Tabs URLs" button
    copyAllTabsBtn.addEventListener('click', async () => {
        chrome.tabs.query({ currentWindow: true }, async (tabs) => {
            if (tabs.length === 0) {
                showMessage('No tabs found in the current window.', 'error');
                return;
            }
            // Store full tab objects for saving (will be stringified later)
            tabsToSave = tabs.map(tab => ({ title: tab.title, url: tab.url }));
            const formattedText = formatUrlsOnly(tabs);
            if (formattedText) {
                await copyToClipboard(formattedText);
            }
        });
    });

    // Function to open URLs from a given array
    function openUrls(urls) {
        if (urls.length === 0) {
            showMessage('No valid URLs to open.', 'error');
            return;
        }
        let openedCount = 0;
        for (const url of urls) {
            try {
                new URL(url); // Throws if invalid URL
                chrome.tabs.create({ url: url, active: false }); // Open in new background tab
                openedCount++;
            } catch (e) {
                console.warn(`Skipping invalid URL: ${url}`);
            }
        }
        showMessage(`Successfully Opened ${openedCount} tab(s).`, 'success');
    }

    // Event listener for "Paste & Open URLs" button
    pasteAndOpenBtn.addEventListener('click', async () => {
        let textToParse = '';
        try {
            textToParse = await navigator.clipboard.readText();
            if (!textToParse.trim()) {
                showMessage('Clipboard is empty or contains no text.', 'error');
                return;
            }
        } catch (err) {
            console.error('Failed to read from clipboard: ', err);
            showMessage('Failed to read from clipboard. Please ensure you have granted clipboard read permission and try again.', 'error');
            return;
        }

        let urlsToOpen = [];
        const lines = textToParse.split(/[\n\s]+/).filter(line => line.trim() !== '');

        for (const line of lines) {
            if (line.startsWith('http://') || line.startsWith('https://')) {
                urlsToOpen.push(line);
            }
        }

        if (urlsToOpen.length === 0) {
            showMessage('No valid URLs found in clipboard to open. Please paste one URL per line or separated by spaces.', 'error');
            return;
        }

        openUrls(urlsToOpen); // Use the new openUrls function
    });

    // Event listener for "Save Current Copy" button
    saveCurrentCopyBtn.addEventListener('click', () => {
        if (tabsToSave.length === 0) {
            showMessage("No tabs copied yet to save. Please 'Copy' first.", "error");
            // Hide input/confirm if no tabs to save
            saveNameInput.classList.add('hidden');
            confirmSaveNameBtn.classList.add('hidden');
            return;
        }
        // Toggle visibility of input and confirm button
        saveNameInput.classList.toggle('hidden');
        confirmSaveNameBtn.classList.toggle('hidden');
        saveNameInput.value = ''; // Clear previous input
        if (!saveNameInput.classList.contains('hidden')) {
            saveNameInput.focus(); // Focus if visible
        }
    });

    // Confirm save name button
    confirmSaveNameBtn.addEventListener('click', async () => {
        const saveName = saveNameInput.value.trim();
        if (!saveName) {
            showMessage("Please enter a name for your saved list.", "error");
            return;
        }

        try {
            // Retrieve existing saved lists
            const result = await chrome.storage.local.get(['savedTabLists']);
            const savedTabLists = result.savedTabLists || [];

            // Create a unique ID for the new list
            const newId = Date.now().toString(); // Simple unique ID based on timestamp

            // Add the new list
            savedTabLists.push({
                id: newId,
                name: saveName,
                urls: JSON.stringify(tabsToSave), // Store as JSON string
                timestamp: Date.now()
            });

            // Save the updated array back to local storage
            await chrome.storage.local.set({ savedTabLists: savedTabLists });

            showMessage(`'${saveName}' saved successfully!`, 'success');
            saveNameInput.classList.add('hidden'); // Hide input after saving
            confirmSaveNameBtn.classList.add('hidden'); // Hide confirm button after saving
            tabsToSave = []; // Clear tabs after saving
            loadSavedTabs(); // Reload and display the lists
        } catch (e) {
            console.error("Error saving to local storage: ", e);
            showMessage("Failed to save list. Please try again.", "error");
        }
    });

    // Function to load and display saved tabs from local storage
    async function loadSavedTabs() {
        try {
            const result = await chrome.storage.local.get(['savedTabLists']);
            let savedItems = result.savedTabLists || [];

            savedTabsList.innerHTML = ''; // Clear existing list

            // Sort by timestamp (most recent first)
            savedItems.sort((a, b) => b.timestamp - a.timestamp);

            if (savedItems.length === 0) {
                noSavedTabsMessage.classList.remove('hidden');
            } else {
                noSavedTabsMessage.classList.add('hidden');
                savedItems.forEach(item => {
                    const savedItemDiv = document.createElement('div');
                    savedItemDiv.className = 'saved-item';
                    savedItemDiv.dataset.id = item.id; // Store ID for deletion

                    const itemNameSpan = document.createElement('span');
                    itemNameSpan.className = 'saved-item-name';
                    itemNameSpan.textContent = item.name;
                    // Add click listener to name to open URLs
                    itemNameSpan.addEventListener('click', () => {
                        try {
                            const urls = JSON.parse(item.urls).map(tab => tab.url);
                            openUrls(urls); // Use the new openUrls function
                        } catch (e) {
                            console.error("Error parsing saved URLs:", e);
                            showMessage("Failed to open URLs from saved list.", "error");
                        }
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-button';
                    deleteBtn.innerHTML = '&#x2716;'; // Changed text to an 'X' icon (multiplication sign)
                    deleteBtn.addEventListener('click', async (event) => {
                        event.stopPropagation(); // Prevent opening URLs when deleting
                        try {
                            const currentListsResult = await chrome.storage.local.get(['savedTabLists']);
                            let currentLists = currentListsResult.savedTabLists || [];
                            // Filter out the item to be deleted
                            const updatedLists = currentLists.filter(list => list.id !== item.id);

                            await chrome.storage.local.set({ savedTabLists: updatedLists });
                            showMessage(`'${item.name}' deleted.`, 'success');
                            loadSavedTabs(); // Reload and display the lists
                        } catch (e) {
                            console.error("Error deleting from local storage: ", e);
                            showMessage("Failed to delete list. Please try again.", "error");
                        }
                    });

                    savedItemDiv.appendChild(itemNameSpan);
                    savedItemDiv.appendChild(deleteBtn);
                    savedTabsList.appendChild(savedItemDiv);
                });
            }
        } catch (error) {
            console.error("Error loading saved tabs from local storage:", error);
            showMessage("Failed to load saved lists.", "error");
        }
    }

    // Initial load of saved tabs when the popup opens
    loadSavedTabs();
});