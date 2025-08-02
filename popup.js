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

// --- State ---
let tabsToSave = [];
let messageTimeout;

// --- UI Functions ---
const showMessage = (message, type = 'success', duration = 3000) => {
    clearTimeout(messageTimeout);
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.style.visibility = 'visible';
    messageTimeout = setTimeout(() => {
        messageBox.style.visibility = 'hidden';
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
const getSyncedSessions = async () => {
    const { savedSessions = [] } = await chrome.storage.sync.get('savedSessions');
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
    saveNameInput.value = '';
    toggleSaveForm(false);
    tabsToSave = [];
    saveCurrentCopyBtn.disabled = true;
};

const handleSavedListClick = async (e) => {
    const item = e.target.closest('.saved-item');
    if (!item) return;

    const button = e.target.closest('.delete-button');
    const id = item.dataset.id;
    const sessions = await getSyncedSessions();

    if (button) {
        const updatedSessions = sessions.filter(s => s.id !== id);
        await saveSyncedSessions(updatedSessions);
        showMessage("Session deleted.", "success");
    } else {
        const session = sessions.find(s => s.id === id);
        if (session && session.urls) {
            session.urls.forEach(tab => chrome.tabs.create({ url: tab.url, active: false }));
            showMessage(`Opening session '${session.name}'...`);
        }
    }
};

// --- NEW IMPORT/EXPORT HANDLERS ---
const handleExport = async () => {
    const sessions = await getSyncedSessions();
    if (sessions.length === 0) {
        return showMessage('Nothing to export.', 'error');
    }

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

            if (!Array.isArray(importedSessions)) {
                throw new Error('Invalid format: not an array.');
            }

            const existingSessions = await getSyncedSessions();
            
            // Merge sessions and remove duplicates, giving preference to imported data
            const sessionMap = new Map();
            existingSessions.forEach(s => sessionMap.set(s.id, s));
            importedSessions.forEach(s => sessionMap.set(s.id, s)); // Overwrites if ID exists

            const mergedSessions = Array.from(sessionMap.values());
            await saveSyncedSessions(mergedSessions);

            showMessage('Sessions imported successfully!', 'success');
        } catch (err) {
            console.error('Import failed:', err);
            showMessage('Import failed. Invalid file.', 'error');
        } finally {
            // Reset input so the same file can be imported again
            importInput.value = '';
        }
    };
    reader.readAsText(file);
};

// --- Initialization ---
const init = () => {
    copyAllTabsBtn.addEventListener('click', handleCopy);
    pasteAndOpenBtn.addEventListener('click', handlePasteAndOpen);
    saveCurrentCopyBtn.addEventListener('click', () => toggleSaveForm(true));
    confirmSaveNameBtn.addEventListener('click', handleConfirmSave);
    savedTabsList.addEventListener('click', handleSavedListClick);
    exportBtn.addEventListener('click', handleExport);
    importInput.addEventListener('change', handleImport);
    
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.savedSessions) {
            renderSavedSessions();
        }
    });

    renderSavedSessions();
};

document.addEventListener('DOMContentLoaded', init);