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
let expandedSessionId = null;
let editingSessionId = null;
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

        const isExpanded = expandedSessionId === session.id;
        const isEditing = editingSessionId === session.id;

        // --- Header Section ---
        let nameHtml = `<span class="saved-item-name" title="${session.name}">${session.name}</span>`;
        if (isEditing) {
            nameHtml = `<input type="text" class="rename-input" value="${session.name}">`;
        }

        itemDiv.innerHTML = `
            <div class="session-header">
                <div class="expand-toggle ${isExpanded ? 'expanded' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                </div>
                <div class="session-title-container">
                    ${nameHtml}
                    ${!isEditing ? `
                    <button class="session-btn edit-name" title="Rename Session">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>` : ''}
                </div>
                <div class="session-controls">
                    <button class="session-btn open-window" title="Open in New Window">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                    </button>
                    <button class="session-btn open-group" title="Open in Tab Group">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg>
                    </button>
                    <button class="session-btn delete" title="Delete Session">
                        <div class="delete-icon"></div>
                    </button>
                </div>
            </div>
            
            <!-- Expanded List -->
            <div class="url-list ${isExpanded ? 'visible' : ''}">
                ${isExpanded && session.urls ? session.urls.map((url, idx) => `
                    <div class="url-item" data-idx="${idx}">
                        <span class="url-text" title="${url.url}">${url.title || url.url}</span>
                        <button class="url-delete-btn" title="Remove URL">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    </div>
                `).join('') : ''}
            </div>
        `;
        fragment.appendChild(itemDiv);
    });
    savedTabsList.appendChild(fragment);

    // Focus input if editing
    if (editingSessionId) {
        const input = savedTabsList.querySelector(`.saved-item[data-id="${editingSessionId}"] .rename-input`);
        if (input) {
            input.focus();
            input.addEventListener('blur', () => handleRenameFinish(editingSessionId, input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleRenameFinish(editingSessionId, input.value);
            });
        }
    }
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

    // --- Specific URL Deletion ---
    const urlDelBtn = e.target.closest('.url-delete-btn');
    if (urlDelBtn) {
        const urlItem = urlDelBtn.closest('.url-item');
        const idx = parseInt(urlItem.dataset.idx, 10);
        await handleDeleteSingleUrl(id, idx);
        return;
    }

    // --- Header Actions ---
    // Rename Toggle
    if (e.target.closest('.edit-name')) {
        editingSessionId = id;
        renderSavedSessions();
        return;
    }

    // Expand/Collapse (Chevron or Header BG)
    const expandToggle = e.target.closest('.expand-toggle') || (e.target.closest('.session-header') && !e.target.closest('.session-btn') && !e.target.closest('.rename-input'));
    if (expandToggle) {
        expandedSessionId = expandedSessionId === id ? null : id;
        renderSavedSessions();
        return;
    }

    const btn = e.target.closest('.session-btn');
    if (!btn) return; // Actions below are for main session buttons only

    if (btn.classList.contains('delete')) {
        const sessionKey = `${SESSION_PREFIX}${id}`;
        const { [SESSION_ORDER_KEY]: order = [] } = await chrome.storage.sync.get(SESSION_ORDER_KEY);
        const newOrder = order.filter(sessionId => sessionId !== id);

        // Remove the session object and update the order array
        await chrome.storage.sync.remove(sessionKey);
        await chrome.storage.sync.set({ [SESSION_ORDER_KEY]: newOrder });

        showMessage("Session deleted.", "success");
    } else if (btn.classList.contains('open-window')) {
        openSessionInNewWindow(id);
    } else if (btn.classList.contains('open-group')) {
        openSessionInGroup(id);
    }
};

const handleRenameFinish = async (id, newName) => {
    newName = newName.trim();
    if (newName) {
        const sessionKey = `${SESSION_PREFIX}${id}`;
        const data = await chrome.storage.sync.get(sessionKey);
        const session = data[sessionKey];
        if (session) {
            session.name = newName;
            await chrome.storage.sync.set({ [sessionKey]: session });
        }
    }
    editingSessionId = null;
    renderSavedSessions();
};

const handleDeleteSingleUrl = async (sessionId, urlIndex) => {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const data = await chrome.storage.sync.get(sessionKey);
    const session = data[sessionKey];

    if (session && session.urls) {
        session.urls.splice(urlIndex, 1); // Remove URL at index

        // If empty, user might want to delete whole session, but for now just save empty list
        await chrome.storage.sync.set({ [sessionKey]: session });
        renderSavedSessions();
    }
};

const getSessionData = async (id) => {
    const sessionKey = `${SESSION_PREFIX}${id}`;
    const data = await chrome.storage.sync.get(sessionKey);
    return data[sessionKey];
};

const openSessionInCurrentWindow = async (id) => {
    const session = await getSessionData(id);
    if (session && session.urls) {
        session.urls.forEach(tab => chrome.tabs.create({ url: tab.url, active: false }));
        showMessage(`Opening '${session.name}'...`);
    }
};

const openSessionInNewWindow = async (id) => {
    const session = await getSessionData(id);
    if (session && session.urls) {
        const urls = session.urls.map(t => t.url);
        chrome.windows.create({ url: urls, focused: true });
        showMessage(`Opened '${session.name}' in new window.`);
    }
};

const openSessionInGroup = async (id) => {
    const session = await getSessionData(id);
    if (session && session.urls) {
        const tabIds = [];
        // Create tabs first
        for (const tab of session.urls) {
            const newTab = await chrome.tabs.create({ url: tab.url, active: false });
            tabIds.push(newTab.id);
        }

        // Group them
        if (tabIds.length > 0) {
            const groupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(groupId, { title: session.name });
            showMessage(`Opened '${session.name}' in group.`);
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