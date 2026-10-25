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
npm run electron:dev
```
On first launch, choose one or more music folders when prompted. Luna indexes supported audio files recursively and stores the folder list and track metadata in `music-library.json` under Electron's user data directory. On later launches, the cached library appears immediately while Luna checks saved folders in the background for added, changed, or removed tracks. App settings (theme, accent color, and last played track) are stored separately under Electron's user data directory. Windows uses a frameless custom title bar and can use the Windows accent color from **Settings → Appearance**. You can add folders from the Options menu or review saved locations and rescan from **Settings → Library**.

In the desktop app, right-click a track in **Tracks** and choose **Edit metadata** to change its title, artist, album, album artist, composer, genre, year, track/disc number, comment, embedded album art, or lyrics. Changes are written into the audio file itself. The editor supports MP3, FLAC, M4A/MP4, and OGG/OGA files; other scanned formats remain playable but are not editable. Lyrics can be pasted as plain text or imported from an `.lrc` file, whose timestamps are preserved in the embedded lyrics text. Luna reads embedded lyric tags; unrelated comments, descriptions, and external sidecar files are not treated as lyrics. Text decoding supports Unicode byte-order marks and detected legacy encodings; lyric rendering supports right-to-left text and falls back to fonts available on the system for non-Latin scripts. On Windows, hover over Luna's taskbar icon to access Previous, Play/Pause, and Next controls.

Artist cards and artist detail pages can look up artist images and introductory biographies through the English Wikipedia API; images are served from Wikimedia Commons and lookup results are cached locally. **Settings → Now Playing → Automatically download artist images** controls whether artist-card images are fetched and saved in a local IndexedDB cache for reuse in Now Playing. Cached artist images remain available offline while this option is enabled; first-time image lookups and artist biographies require an internet connection. Turning downloads off also disables and turns off the optional artist-image background. Artist credits separated by commas, ampersands, slashes, semicolons, or common collaboration terms such as "feat.", "ft.", "with", and "x" are shown as individual artists, with each artist's credited tracks and albums grouped on their own detail page. Artist detail pages show albums below the track list and an **About artist** section with a link to the source article when available. Artists without a matching image continue to use the app's placeholder artwork.

### Connect Spotify

Open **Spotify** in Luna and follow the three short steps shown there: create a Spotify app, add Luna's return address (the page has a copy button), and paste its **Client ID** into Luna. This is a one-time setup; do not copy or share a Client Secret. For Spotify Development mode apps, add the Spotify account you will sign in with under the app's **Settings → Users Management**; Spotify also requires the app owner to have Premium. After setup, choose **Connect with Spotify** and approve access on Spotify's website. Luna can then show your playlists and their tracks, saved music, recent listening, and top artists/tracks. Desktop sign-in uses the loopback URI `http://127.0.0.1:43821/callback`, which is HTTP on a local IP address as allowed by Spotify; register it exactly as shown in Luna. Desktop sign-in and refresh tokens are encrypted using Electron secure storage; web sessions last for the current browser tab. Spotify-hosted sign-in may offer Google as an identity provider for Spotify, but a Google account by itself does not grant access to Spotify data.

For developers who maintain custom Luna builds, the Client ID can instead be provided at build time with `REACT_APP_SPOTIFY_CLIENT_ID`; in that case, users can skip the Client ID entry step. `.env.example` shows the optional web callback setting for local web development.

Use the **Tracks**, **Albums**, and **Artists** views to browse or play library items. Their indexes follow the current sort and visible list, sorting names with letters or numbers before symbols and other characters; click or drag along an index to jump through it, and the system-accent highlight indicates the section at the current scroll position. Unicode letters and numbers have their own index entries, symbols use `#`, and other characters use `…`. Downloaded artist images are cached locally for later offline use; cached images can still be displayed when automatic downloads are disabled, and cards show a default placeholder when no image is available. The Play queue has the same index while it contains tracks. The web-only `npm start` version cannot scan arbitrary folders on your computer; local-folder access requires Electron.
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
| `npm start` | Run web development server |
| `npm run build` | Build for production |
| `npm run electron:dev` | Run Electron with hot reload |
| `npm run electron:build` | Build Electron app |
| `npm run cap:add android/ios` | Add mobile platform |
| `npm run cap:copy` | Copy web assets to mobile |
| `npm run cap:open android/ios` | Open in IDE |

## License

MIT License - see [LICENSE.md](LICENSE.md)
