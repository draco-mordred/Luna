# Luna Music Player

A minimal, beautiful music player app with Apple Music and Samsung Music inspired UI. Runs on **Electron (desktop)** and **Capacitor (mobile)**.

## Features

- Apple Music layout with Samsung Music "Now Playing" interface
- Bottom-positioned draggable PlayBar
- Expands to full "Now Playing" view
- Displays album art with default fallback
- Fetches artist images and short biographies from Wikipedia for artist cards and artist detail pages
- Shows artist images as the Now Playing background when enabled in **Settings → Now Playing**
- Displays an artist's albums and a short "About artist" biography on artist detail pages
- Playback controls: Previous, Play/Pause, Next, Volume
- Desktop music library scanning with saved folders and audio metadata
- In-place editing of track tags and embedded album artwork
- Embedded plain or timestamped lyrics
- Local track playback with seek, shuffle, and repeat controls
- Online Jamendo catalog search and streaming
- Audiomack catalog search and streaming through its official API
- Radio section tabs for Radio, Jamendo, and Audiomack
- Touch and mouse support

## Project Structure

```
luna-player/
├── public/                  # Static files & Electron entry
│   ├── electron.js          # Electron main process
│   ├── preload.js           # Electron preload script
│   └── ...
├── src/
│   ├── components/
│   │   └── PlayBar/         # The draggable PlayBar component
│   │       ├── PlayBar.tsx
│   │       ├── PlayBar.css
│   │       └── index.ts
│   ├── App.tsx              # Main app component
│   ├── App.css              # Global styles
│   ├── index.tsx            # Entry point
│   ├── react-app-env.d.ts
│   └── types/
│       └── index.ts         # TypeScript types
├── capacitor.config.ts      # Mobile configuration
├── electron-builder.json    # Desktop build configuration
└── package.json
```

## Quick Start

### Install Dependencies
```bash
npm install
```

### Run Web Version
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000)

### Run Electron (Desktop)
```bash
npm run dev
```
Starts the React development server without opening a browser, then launches the app in an Electron window. The Electron window uses the development server for hot reload; no production build is created. `npm start` remains available when you want the browser version.
On first launch, choose one or more music folders when prompted. Luna indexes supported audio files recursively and stores the folder list and track metadata in `music-library.json` under Electron's user data directory. On later launches, the cached library appears immediately while Luna checks saved folders in the background for added, changed, or removed tracks. App settings (theme, accent color, and last played track) are stored separately under Electron's user data directory. Windows uses a frameless custom title bar and can use the Windows accent color from **Settings → Appearance**. You can add folders from the Options menu or review saved locations and rescan from **Settings → Library**.

In the desktop app, right-click a track in **Tracks** and choose **Edit metadata** to change its title, artist, album, album artist, composer, genre, year, track/disc number, comment, embedded album art, or lyrics. Changes are written into the audio file itself. The editor supports MP3, FLAC, M4A/MP4, and OGG/OGA files; other scanned formats remain playable but are not editable. Lyrics can be pasted as plain text or imported from an `.lrc` file, whose timestamps are preserved in the embedded lyrics text. Luna reads embedded lyric tags; unrelated comments, descriptions, and external sidecar files are not treated as lyrics. Text decoding supports Unicode byte-order marks and detected legacy encodings; lyric rendering supports right-to-left text and falls back to fonts available on the system for non-Latin scripts. On Windows, hover over Luna's taskbar icon to access Previous, Play/Pause, and Next controls.

Artist cards and artist detail pages can look up artist images and introductory biographies through the English Wikipedia API; images are served from Wikimedia Commons and lookup results are cached locally. **Settings → Now Playing → Automatically download artist images** controls whether artist-card images are fetched and saved in a local IndexedDB cache for reuse in Now Playing. Cached artist images remain available offline while this option is enabled; first-time image lookups and artist biographies require an internet connection. Turning downloads off also disables and turns off the optional artist-image background. Artist credits separated by commas, ampersands, slashes, semicolons, or common collaboration terms such as "feat.", "ft.", "with", and "x" are shown as individual artists, with each artist's credited tracks and albums grouped on their own detail page. Artist detail pages show albums below the track list and an **About artist** section with a link to the source article when available. Artists without a matching image continue to use the app's placeholder artwork.

Large local libraries are supported: folder scans reuse cached metadata for unchanged files and read uncached files with limited parallelism. Newly parsed tracks stream into the library during a scan, appear sorted in the Tracks page, and can be played before scanning finishes. Tracks only mounts rows near the visible area, and the alphanumeric indexes span the full track, album, or artist list.

### Stream Jamendo music

Open **Radio → Jamendo** in Luna and enter a Client ID from an app registered in the [Jamendo developer portal](https://devportal.jamendo.com/). Luna uses Jamendo's public API to search its catalog and stream tracks; it does not require a Jamendo account login. The Client ID is stored in the current browser or app profile. Do not enter an account password or secret key.

Jamendo provides independent music rather than the mainstream catalogs offered by subscription services. Tracks are provided under their respective licenses. Luna links each track to its Jamendo page and license; developers distributing Luna must follow the [Jamendo API terms](https://devportal.jamendo.com/api_terms_of_use), including non-commercial-use limits unless Jamendo approves commercial use, attribution, and the track's Creative Commons license. Jamendo playback uses Luna's queue and transport controls, with a provider-specific bottom player in place of the local-library PlayBar. Luna does not download or cache the stream for offline listening.

The Jamendo API has a published allowance of up to 35,000 requests per month for non-commercial apps. Confirm current requirements and terms with Jamendo before distributing or monetizing a build.

### Stream Audiomack music

Open **Radio → Audiomack** in Luna and enter an OAuth 1.0a consumer key and secret issued or authorized by Audiomack. The [API documentation](https://audiomack.com/data-api/docs) describes search, trending, and track-play endpoints, but does not document how to obtain consumer credentials; request API access from Audiomack before using this integration. Luna signs API requests in Electron's main process and stores the credentials using Electron `safeStorage` rather than placing them in renderer code or browser storage. Audiomack streaming is supported in the Electron desktop app, not the browser-only or Capacitor versions.

Luna searches Audiomack's song catalog and uses the shared queue and transport controls, with a provider-specific bottom player in place of the local-library PlayBar. It requests a temporary streaming URL just before playback, sends a per-install session ID for play tracking, and does not download or cache Audiomack audio. Use of the API and streams remains subject to Audiomack's approval and [Terms of Service](https://audiomack.com/about/terms-of-service). Verify API access, playback, tracking, attribution, and distribution requirements with Audiomack before releasing or monetizing an app.

Use the **Tracks**, **Albums**, and **Artists** views to browse or play library items. Their indexes follow the current sort and visible list, sorting names with letters or numbers before symbols and other characters; click or drag along an index to align the selected section's first item with the top of the scroll area. The system-accent highlight indicates the section at the current scroll position. Unicode letters and numbers have their own index entries, symbols use `#`, and other characters use `…`. Downloaded artist images are cached locally for later offline use; cached images can still be displayed when automatic downloads are disabled, and cards show a default placeholder when no image is available. The Play queue has the same index while it contains tracks. The web-only `npm start` version cannot scan arbitrary folders on your computer; local-folder access requires Electron.
The Material Symbols icon font is bundled with the app, so Electron can render icons without an internet connection.

### Set Up Mobile
```bash
npx cap init
npm run cap:add android
npm run cap:copy
npm run cap:open android
```

## Usage

### PlayBar
The PlayBar at the bottom provides:

- **Drag the top handle** to expand/collapse
- **Album art** with default fallback
- **Track info**: Name, Artist, Album
- **Controls**: Previous, Play/Pause, Next
- **Volume slider**
- **Expand button** for quick toggle

### Touch & Drag
- **Mouse**: Click and drag the top bar
- **Touch**: Tap and drag on mobile
- Auto-snaps to collapsed (72px) or expanded (400px)

## Configuration

### Electron
- Edit `public/electron.js` for window settings
- Edit `electron-builder.json` for build options

### Capacitor
- Edit `capacitor.config.ts` for mobile settings

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run the development app in Electron without opening a browser |
| `npm start` | Run web development server |
| `npm run build` | Build for production |
| `npm run electron:dev` | Run Electron with hot reload |
| `npm run electron:build` | Build Electron app |
| `npm run cap:add android/ios` | Add mobile platform |
| `npm run cap:copy` | Copy web assets to mobile |
| `npm run cap:open android/ios` | Open in IDE |

## License

MIT License - see [LICENSE.md](LICENSE.md)
