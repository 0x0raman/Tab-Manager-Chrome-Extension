# Tab URL Manager

![Version](https://img.shields.io/badge/version-2.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/platform-Chrome-brightgreen)

A sleek, modern, and minimalist Chrome extension to effortlessly manage your browser tabs. Copy all open tab URLs, paste a list of links to open them instantly, and save entire sessions to your synced Chrome account.

---

## Key Features

* **Copy URLs**: Instantly copy the URLs of all open tabs in the current window to your clipboard with a single click.
* **Paste & Open**: Paste a list of URLs (separated by newlines or spaces) to open them all in new tabs simultaneously.
* **Save Session**: Save the current set of copied tabs as a named session.
* **Chrome Sync**: All saved sessions are automatically synced across any device where you are logged into your Chrome account. No external accounts needed.
* **Sleek UI**: A compact, icon-driven dark theme that is space-efficient and feels native to the browser.
* **Flexible Layout**: The popup dynamically resizes based on its content, keeping the UI minimal and clean.

---

## Installation

Since this extension is not on the Chrome Web Store, you can load it locally for development or personal use.

1.  **Clone or Download**: Clone this repository or download it as a ZIP file and unzip it.
    ```sh
    git clone [https://github.com/your-username/tab-url-manager.git](https://github.com/your-username/tab-url-manager.git)
    ```
2.  **Open Chrome Extensions**: Open Google Chrome and navigate to `chrome://extensions`.
3.  **Enable Developer Mode**: In the top right corner, toggle the "Developer mode" switch on.
4.  **Load Unpacked**: Click the "Load unpacked" button that appears on the left.
5.  **Select Folder**: Navigate to and select the folder where you cloned or unzipped the repository.

The Tab URL Manager icon should now appear in your browser's extension toolbar.

---

## How to Use

1.  **Copy URLs**:
    * Click the **Copy** icon (looks like two overlapping pages).
    * All URLs from the current window are now on your clipboard. This also enables the "Save Session" button.

2.  **Paste & Open URLs**:
    * Copy a list of URLs to your clipboard.
    * Click the **Paste** icon (looks like a clipboard with a down arrow).
    * All valid URLs from your clipboard will open in new background tabs.

3.  **Save a Session**:
    * First, use the **Copy** function to load a set of tabs into the extension.
    * Click the **Save Session** icon (looks like a floppy disk).
    * An input field will appear. Type a name for your session and click the **Checkmark** button.
    * Your session is now saved and synced.

4.  **Open or Delete a Saved Session**:
    * **To open**: Simply click on the name of any session in the "Synced Sessions" list.
    * **To delete**: Click the **Trash Can** icon next to the session name you wish to remove.

---

## Technology Stack

* **Manifest V3**: The latest standard for Chrome extensions, ensuring enhanced security and performance.
* **HTML5**: For the core structure of the popup.
* **CSS3**: For the sleek, modern, and responsive dark theme. Uses CSS Variables and Flexbox/Grid for layout.
* **Vanilla JavaScript**: For all the extension's logic, using modern ES modules and async/await.
* **`chrome.storage.sync` API**: For seamless, account-based syncing of saved sessions across devices.

---

## Contributing

Contributions are welcome! If you have ideas for new features, improvements, or bug fixes, please feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourAmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some YourAmazingFeature'`).
4.  Push to the branch (`git push origin feature/YourAmazingFeature`).
5.  Open a Pull Request.
