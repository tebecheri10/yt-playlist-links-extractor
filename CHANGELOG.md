# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-07

### Added
- Three new output formats: **Markdown** (`- [title](url)`), **CSV** (with RFC-4180 escaping) and **JSON**
- **Download** button — save the extracted list as a `.txt`, `.md`, `.csv` or `.json` file (filename derived from the playlist title)
- Live extraction progress — the status shows videos loaded as they scroll in (e.g. "Loading videos… 120 / 300"), for both same-tab and background extraction
- Remembers your last selected output format across sessions

### Changed
- Format switching is now a dropdown (Full / NotebookLM / Markdown / CSV / JSON) with unified **Copy** and **Download** actions, replacing the two dedicated copy buttons
- Adaptive auto-scroll: waits only as long as needed for new videos to load (faster on good connections, more reliable on slow ones) instead of a fixed 900 ms per step
- More tolerant stop detection and a higher iteration cap for very large playlists

## [1.2.0] - 2025-03

### Added
- Bilingual support: English and Spanish, with auto-detection based on system language
- Language toggle button (EN / ES) in the popup header
- "NotebookLM" output format — URLs only, one per line
- Format toggle buttons: Full (title + URL) and NotebookLM (URLs only)
- Separate copy buttons for each format
- In-popup tutorial / help panel with step-by-step instructions
- Playlist title preview shown above the extract button
- Auto-fill URL when popup is opened on a YouTube playlist tab
- Support for shorthand playlist IDs (PL, RD, FL, UU, LL, WL prefixes)
- Reset button to clear results and start a new extraction
- Stale-detection during auto-scroll: stops if video count doesn't increase after 3 iterations
- Persistent language preference saved across sessions

### Changed
- Improved extraction flow: same-tab extraction vs. background tab extraction are handled separately
- Popup polls storage every 800ms for background extraction results (up to 3 minutes)
- Auto-scroll max iterations increased to 60 (supports larger playlists)

## [1.1.0] - 2025-02

### Added
- Background extraction: open playlist in a new tab and extract without keeping popup open
- Storage-based state management for cross-popup communication
- Service worker (background.js) handles tab lifecycle

## [1.0.0] - 2025-01

### Added
- Initial release
- Extract all video URLs from a YouTube playlist
- Auto-scroll to load all videos before extracting
- Copy to clipboard button
- Dark theme matching YouTube's UI
