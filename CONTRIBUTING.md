# Contributing to YouTube Playlist Link Extractor

Thank you for your interest in contributing! This is a Chrome extension built with Manifest V3, plain JavaScript, and no build step required.

## Getting Started

### Prerequisites
- Google Chrome or Chromium
- Node.js (only needed to regenerate icons)

### Load the extension locally

1. Clone the repository:
   ```bash
   git clone https://github.com/tebecheridaniel/yt-playlist-links-extractor.git
   cd yt-playlist-links-extractor
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top right)

4. Click **Load unpacked** and select the project folder

5. The extension icon will appear in your toolbar

### Regenerate icons (optional)

Icons are pre-generated and committed. If you need to regenerate them:

```bash
npm install
npm run generate-icons
```

## Project Structure

```
├── manifest.json              # Extension configuration (Manifest V3)
├── package.json
├── icons/                     # Extension icons (16, 48, 128px)
├── scripts/
│   └── generate-icons.js      # Script to regenerate icons
└── src/
    ├── background.js           # Service worker — handles tab lifecycle and storage
    ├── content.js              # Content script — injected into YouTube, does the scroll + extraction
    └── popup/
        ├── popup.html          # Extension popup UI
        ├── popup.js            # UI state, handlers, init
        ├── i18n.js             # EN/ES translations
        ├── storage.js          # chrome.storage wrapper + language helpers
        ├── url.js              # URL validation and normalization helpers
        └── messaging.js        # Tab messaging and storage polling
```

## How It Works

1. **Popup** opens and detects if the current tab is a YouTube playlist.
2. User clicks "Extract links".
3. If the playlist is already open in the current tab → popup sends a message directly to **content.js**.
4. If not → **background.js** opens a new tab, waits for it to load, then messages **content.js**.
5. **content.js** auto-scrolls the page to load all videos, then extracts titles and URLs.
6. Results are saved to `chrome.storage.local` and the popup reads them.

## Submitting Changes

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test manually with Chrome's "Load unpacked"
5. Submit a Pull Request with a clear description of what changed and why

## Reporting Issues

Please include:
- Chrome version
- Extension version
- The YouTube playlist URL (or a similar public one that reproduces the issue)
- What you expected vs. what happened
- Any errors shown in the extension's service worker console (`chrome://extensions` → Details → Service worker)

## Known Limitations

- Depends on YouTube's DOM structure (`ytd-playlist-video-renderer`, `#video-title`). YouTube may change these selectors without notice.
- Private playlists cannot be extracted.
- Very large playlists (400+ videos) may hit the 60-iteration scroll limit.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
