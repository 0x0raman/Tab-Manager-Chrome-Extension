// --- DOM Elements ---
const getEl = (id) => document.getElementById(id);
const messageBox = getEl('messageBox');
const copyAllTabsBtn = getEl('copyAllTabsBtn');
const pasteAndOpenBtn = getEl('pasteAndOpenBtn');
const saveCurrentCopyBtn = getEl('saveCurrentCopyBtn');
const saveForm = getEl('saveForm');
const saveNameInput = getEl('saveNameInput');
const confirmSaveNameBtn = getEl('confirmSaveNameBtn');
const savedTabsList = getEl('savedTabsList');
const noSavedTabsMessage = getEl('noSavedTabsMessage');

// --- State ---
let tabsToSave = [];

// --- UI Functions ---
const showMessage = (message, type = 'success', duration = 3000) => {
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.style.visibility = 'visible';
    setTimeout(() => {
        messageBox.style.visibility = 'hidden';
    }, duration);
};

const toggleSaveForm = (show) => {
    saveForm.classList.toggle('hidden', !show);
    if (show) saveNameInput.focus();
};

const renderSavedSessions = async () => {
    const sessions = await getSyncedSessions();
    savedTabsList.innerHTML = ''; // Clear previous list
    
    noSavedTabsMessage.classList.toggle('hidden', sessions.length > 0);
    if (sessions.length === 0) return;

    const fragment = document.createDocumentFragment();
    sessions.forEach(session => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'saved-item';
        itemDiv.dataset.id = session.id;
        itemDiv.innerHTML = `
            <span class="saved-item-name">${session.name}</span>
            <button class="delete-button" data-id="${session.id}" aria-label="Delete ${session.name}">
                <div class="delete-icon"></div>
            </button>
        `;
        fragment.appendChild(itemDiv);
    });
    savedTabsList.appendChild(fragment);
};

// --- Data Functions (chrome.storage.sync) ---
const getSyncedSessions = async () => {
    const { savedSessions = [] } = await chrome.storage.sync.get('savedSessions');
    // Sort by timestamp descending (most recent first)
    return savedSessions.sort((a, b) => b.timestamp - a.timestamp);
};

const saveSyncedSessions = (sessions) => {
    return chrome.storage.sync.set({ savedSessions: sessions });
};

// --- Event Handlers ---
const handleCopy = async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length === 0) return showMessage('No tabs to copy.', 'error');
    
    tabsToSave = tabs.map(tab => ({ title: tab.title, url: tab.url }));
    const urlText = tabs.map(tab => tab.url).join('\n');
    
    await navigator.clipboard.writeText(urlText);
    showMessage('URLs copied to clipboard!');
    saveCurrentCopyBtn.disabled = false;
};

const handlePasteAndOpen = async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) return showMessage('Clipboard is empty.', 'error');
        
        const urls = text.match(/https?:\/\/[^\s/$.?#].[^\s]*/gi) || [];
        if (urls.length === 0) return showMessage('No valid URLs found.', 'error');

        let openedCount = 0;
        urls.forEach(url => {
            try {
                new URL(url);
                chrome.tabs.create({ url, active: false });
                openedCount++;
            } catch (e) { console.warn(`Skipping invalid URL: ${url}`); }
        });
        if (openedCount > 0) showMessage(`Opened ${openedCount} tab(s).`);

    } catch (err) {
        console.error('Failed to read from clipboard:', err);
        showMessage('Could not read clipboard.', 'error');
    }
};

const handleConfirmSave = async () => {
    const name = saveNameInput.value.trim();
    if (!name) return showMessage('Please enter a name.', 'error');
    if (tabsToSave.length === 0) return showMessage('Nothing to save.', 'error');

    const sessions = await getSyncedSessions();
    const newSession = {
        id: crypto.randomUUID(),
        name,
        urls: tabsToSave,
        timestamp: Date.now()
    };
    
    sessions.push(newSession);
    await saveSyncedSessions(sessions);
    
    showMessage(`'${name}' saved and synced!`, 'success');
    renderSavedSessions();

    saveNameInput.value = '';
    toggleSaveForm(false);
    tabsToSave = [];
    saveCurrentCopyBtn.disabled = true;
};

const handleSavedListClick = async (e) => {
    const button = e.target.closest('.delete-button');
    const item = e.target.closest('.saved-item');
    if (!item) return;

    const id = item.dataset.id;
    if (button) { // If the delete button was clicked
        let sessions = await getSyncedSessions();
        sessions = sessions.filter(s => s.id !== id);
        await saveSyncedSessions(sessions);
        showMessage("Session deleted.", "success");
        renderSavedSessions();
    } else { // If any other part of the item was clicked
        const sessions = await getSyncedSessions();
        const session = sessions.find(s => s.id === id);
        if (session && session.urls) {
            session.urls.forEach(tab => chrome.tabs.create({ url: tab.url, active: false }));
            showMessage(`Opening session '${session.name}'...`);
        }
    }
};

// --- Initialization ---
const init = () => {
    copyAllTabsBtn.addEventListener('click', handleCopy);
    pasteAndOpenBtn.addEventListener('click', handlePasteAndOpen);
    saveCurrentCopyBtn.addEventListener('click', () => toggleSaveForm(true));
    confirmSaveNameBtn.addEventListener('click', handleConfirmSave);
    savedTabsList.addEventListener('click', handleSavedListClick);
    
    // Listen for changes in synced storage and update UI
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.savedSessions) {
            renderSavedSessions();
        }
    });

    // Initial render
    renderSavedSessions();
};

document.addEventListener('DOMContentLoaded', init);
