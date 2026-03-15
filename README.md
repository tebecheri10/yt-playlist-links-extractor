# YouTube Playlist Link Extractor

A Chrome extension that extracts all video links from a YouTube playlist in seconds. Supports two output formats and is available in English and Spanish.

## Features

- **Auto-scroll** — automatically scrolls the playlist page to load every video before extracting
- **Two output formats:**
  - **Full** — `//Video Title` + URL, one per line
  - **URLs only** — plain list of URLs (ideal for NotebookLM and similar tools)
- **Bilingual** — English and Spanish, auto-detected from your system language
- **Smart tab detection** — auto-fills the URL if you already have a playlist open
- **Copy to clipboard** — separate copy buttons for each format
- **Background extraction** — works even if you navigate away while it's running
- No account required, no data sent anywhere

## Installation

### From the Chrome Web Store

*(Coming soon — link will be added after publication)*

### Manual installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. The extension icon will appear in your Chrome toolbar

## Usage

**Option A — From a playlist tab:**
1. Open any YouTube playlist in Chrome
2. Click the extension icon in the toolbar
3. The URL is auto-filled — click **Extract links**
4. Wait for the auto-scroll to finish
5. Choose your format and click **Copy**

**Option B — Paste a URL:**
1. Click the extension icon from any tab
2. Paste a YouTube playlist URL (or just the `PLxxxxxxx` playlist ID)
3. Click **Extract links**
4. Choose your format and click **Copy**

## Output Formats

**Full format:**
```
//Introduction to Machine Learning
https://www.youtube.com/watch?v=...&list=...
//What is Neural Network?
https://www.youtube.com/watch?v=...&list=...
```

**URLs only (NotebookLM format):**
```
https://www.youtube.com/watch?v=...&list=...
https://www.youtube.com/watch?v=...&list=...
```

## Known Limitations

- Depends on YouTube's page structure — may break if YouTube updates its web components
- Cannot extract private playlists
- Very large playlists (400+ videos) may require multiple extraction attempts due to scroll limits
- Slow network connections may cause the extraction to time out

## Development

```bash
# Clone the repo
git clone https://github.com/tebecheri10/yt-playlist-links-extractor.git
cd yt-playlist-links-extractor

# Install dev dependencies (only needed for icon generation)
npm install

# Regenerate icons
npm run generate-icons
```

Load the extension in Chrome via **Developer mode → Load unpacked** pointing to this folder.

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details on the project structure and how to submit changes.

## Project Structure

```
├── manifest.json              # Chrome extension config (Manifest V3)
├── icons/                     # 16, 48, 128px icons
├── scripts/
│   └── generate-icons.js      # Dev script to regenerate icons
├── src/
│   ├── background.js          # Service worker
│   ├── content.js             # Content script (runs on YouTube)
│   └── popup/
│       ├── popup.html         # Extension popup
│       ├── popup.js           # UI state, handlers, init
│       ├── i18n.js            # EN/ES translations
│       ├── storage.js         # Storage wrapper + language helpers
│       ├── url.js             # URL helpers
│       └── messaging.js       # Tab messaging and polling
├── PRIVACY_POLICY.md
├── CHANGELOG.md
└── CONTRIBUTING.md
```

## Privacy

This extension collects no personal data and makes no requests to external servers. All processing happens locally in your browser. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.

## License

[MIT](LICENSE) © 2025 [Daniel Tebecheri](https://github.com/tebecheridaniel) — Argentum Labs
