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
const exportBtn = getEl('exportBtn');
const importInput = getEl('importInput');

// --- State & Constants ---
let tabsToSave = [];
let messageTimeout;
const SESSION_PREFIX = 'session_';
const SESSION_ORDER_KEY = 'session_order';

// --- UI Functions ---
const showMessage = (message, type = 'success', duration = 3000) => {
    clearTimeout(messageTimeout);
    messageBox.textContent = message;
    messageBox.className = `message-box visible ${type}`;
    messageTimeout = setTimeout(() => {
        messageBox.classList.remove('visible');
    }, duration);
};

const toggleSaveForm = (show) => {
    saveForm.classList.toggle('hidden', !show);
    if (show) saveNameInput.focus();
};

const renderSavedSessions = async () => {
    const sessions = await getSyncedSessions();
    savedTabsList.innerHTML = '';
    
    noSavedTabsMessage.classList.toggle('hidden', sessions.length > 0);
    if (sessions.length === 0) return;

    const fragment = document.createDocumentFragment();
    sessions.forEach(session => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'saved-item';
        itemDiv.dataset.id = session.id;
        itemDiv.innerHTML = `
            <span class="saved-item-name">${session.name}</span>
            <button class="delete-button" aria-label="Delete ${session.name}">
                <div class="delete-icon"></div>
            </button>
        `;
        fragment.appendChild(itemDiv);
    });
    savedTabsList.appendChild(fragment);
};

// --- Data Functions (chrome.storage.sync) ---
/**
 * Retrieves all sessions in the user-defined order.
 * It first gets the order array, then fetches each session individually.
 */
const getSyncedSessions = async () => {
    const data = await chrome.storage.sync.get(null);
    const order = data[SESSION_ORDER_KEY] || [];
    const sessions = order
        .map(id => data[SESSION_PREFIX + id])
        .filter(Boolean); // Filter out any inconsistencies
    return sessions;
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

        urls.forEach(url => {
            try {
                new URL(url);
                chrome.tabs.create({ url, active: false });
            } catch (e) { console.warn(`Skipping invalid URL: ${url}`); }
        });
        if (urls.length > 0) showMessage(`Opened ${urls.length} tab(s).`);
    } catch (err) {
        console.error('Failed to read from clipboard:', err);
        showMessage('Could not read clipboard.', 'error');
    }
};

const handleConfirmSave = async () => {
    const name = saveNameInput.value.trim();
    if (!name) return showMessage('Please enter a name.', 'error');
    if (tabsToSave.length === 0) return showMessage('Nothing to save.', 'error');

    const newSession = {
        id: crypto.randomUUID(),
        name,
        urls: tabsToSave,
        timestamp: Date.now()
    };
    
    try {
        const { [SESSION_ORDER_KEY]: order = [] } = await chrome.storage.sync.get(SESSION_ORDER_KEY);
        order.push(newSession.id); // Add new session ID to the end of the order

        const sessionKey = `${SESSION_PREFIX}${newSession.id}`;
        // Save the new session object and the updated order array
        await chrome.storage.sync.set({ [sessionKey]: newSession, [SESSION_ORDER_KEY]: order });
        
        showMessage(`'${name}' saved and synced!`, 'success');
        saveNameInput.value = '';
        toggleSaveForm(false);
        tabsToSave = [];
        saveCurrentCopyBtn.disabled = true;
    } catch (error) {
        console.error("Save failed:", error);
        if (error.message.includes('QUOTA_BYTES')) {
             showMessage('Chrome sync storage is full. Please remove some sessions.', 'error', 5000);
        } else {
             showMessage('An error occurred while saving.', 'error');
        }
    }
};

const handleSavedListClick = async (e) => {
    const item = e.target.closest('.saved-item');
    if (!item) return;

    const id = item.dataset.id;
    const button = e.target.closest('.delete-button');

    if (button) { // Handle Delete
        const sessionKey = `${SESSION_PREFIX}${id}`;
        const { [SESSION_ORDER_KEY]: order = [] } = await chrome.storage.sync.get(SESSION_ORDER_KEY);
        const newOrder = order.filter(sessionId => sessionId !== id);

        // Remove the session object and update the order array
        await chrome.storage.sync.remove(sessionKey);
        await chrome.storage.sync.set({ [SESSION_ORDER_KEY]: newOrder });
        
        showMessage("Session deleted.", "success");
    } else { // Handle Open
        const sessionKey = `${SESSION_PREFIX}${id}`;
        const data = await chrome.storage.sync.get(sessionKey);
        const session = data[sessionKey];
        if (session && session.urls) {
            session.urls.forEach(tab => chrome.tabs.create({ url: tab.url, active: false }));
            showMessage(`Opening session '${session.name}'...`);
        }
    }
};

const handleExport = async () => {
    const sessions = await getSyncedSessions();
    if (sessions.length === 0) return showMessage('Nothing to export.', 'error');

    const jsonString = JSON.stringify(sessions, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `tab-sessions-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('Sessions exported!', 'success');
};

const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedSessions = JSON.parse(e.target.result);
            if (!Array.isArray(importedSessions)) throw new Error('Invalid format');

            const dataToSave = {};
            const newIds = [];

            importedSessions.forEach(session => {
                // Ensure sessions have all required fields before importing
                if (session.id && session.name && Array.isArray(session.urls)) {
                    dataToSave[SESSION_PREFIX + session.id] = session;
                    newIds.push(session.id);
                }
            });
            
            const { [SESSION_ORDER_KEY]: order = [] } = await chrome.storage.sync.get(SESSION_ORDER_KEY);
            const mergedOrder = [...order, ...newIds.filter(id => !order.includes(id))];
            dataToSave[SESSION_ORDER_KEY] = mergedOrder;

            await chrome.storage.sync.set(dataToSave);
            showMessage('Sessions imported successfully!', 'success');
        } catch (err) {
            console.error('Import failed:', err);
            showMessage('Import failed. Invalid file.', 'error');
        } finally {
            importInput.value = '';
        }
    };
    reader.readAsText(file);
};

// --- Initialization ---
const init = () => {
    copyAllTabsBtn.addEventListener('click', handleCopy);
    pasteAndOpenBtn.addEventListener('click', handlePasteAndOpen);
    saveCurrentCopyBtn.addEventListener('click', () => {
        if (!saveCurrentCopyBtn.disabled) toggleSaveForm(true);
    });
    confirmSaveNameBtn.addEventListener('click', handleConfirmSave);
    savedTabsList.addEventListener('click', handleSavedListClick);
    exportBtn.addEventListener('click', handleExport);
    importInput.addEventListener('change', handleImport);
    
    // Listen for any changes in sync storage to re-render the list
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            renderSavedSessions();
        }
    });
    
    // Initialize Drag and Drop
    Sortable.create(savedTabsList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: async () => {
            // When drag ends, get the new order of IDs from the DOM
            const items = savedTabsList.querySelectorAll('.saved-item');
            const newOrder = Array.from(items).map(item => item.dataset.id);
            // Save only the new order array
            await chrome.storage.sync.set({ [SESSION_ORDER_KEY]: newOrder });
        }
    });

    renderSavedSessions();
};

document.addEventListener('DOMContentLoaded', init);