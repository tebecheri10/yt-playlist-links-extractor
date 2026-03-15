# Privacy Policy — YouTube Playlist Link Extractor

**Last updated:** March 2025

## Overview

YouTube Playlist Link Extractor is a Chrome extension that extracts video links from YouTube playlists. This policy explains how the extension handles data.

## Data Collection

**This extension does not collect, transmit, or store any personal data on external servers.**

### What the extension accesses:

| Data | Purpose | Stored? |
|---|---|---|
| Current tab URL | Detect if you are on a YouTube playlist | No — read only |
| YouTube playlist page HTML | Extract video titles and URLs | No — processed in memory |
| User language preference (EN/ES) | Remember your language setting | Yes — locally in your browser only |
| Last extraction result | Resume if popup is closed mid-extraction | Yes — locally, deleted after 5 minutes |

### Permissions used:

- **`activeTab`** — Read the URL of your current tab to detect playlists.
- **`tabs`** — Open a new tab to load playlists that are not currently open.
- **`storage`** — Save language preference and temporary extraction state locally in your browser.
- **`host_permissions: https://www.youtube.com/*`** — Inject the content script into YouTube pages to extract video data.

## Data Sharing

No data is shared with any third party. The extension has no backend, no analytics, no tracking, and makes no network requests to external services. All processing happens locally in your browser.

## Data Retention

- Language preference is stored in `chrome.storage.local` until you uninstall the extension or clear browser data.
- Extraction results are stored temporarily in `chrome.storage.local` and automatically deleted after 5 minutes.

## Changes to This Policy

If a future version of the extension changes how data is handled, this policy will be updated and the extension version will be incremented.

## Contact

For questions or concerns, open an issue on the [GitHub repository](https://github.com/tebecheridaniel/yt-playlist-links-extractor).
