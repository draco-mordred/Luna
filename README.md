# Luna Music Player

A minimal, beautiful music player app with Apple Music and Samsung Music inspired UI. Runs on **Electron (desktop)** and **Capacitor (mobile)**.

## Features

- Apple Music layout with Samsung Music "Now Playing" interface
- Bottom-positioned draggable PlayBar
- Expands to full "Now Playing" view
- Displays album art with default fallback
- Playback controls: Previous, Play/Pause, Next, Volume
- Desktop music library scanning with saved folders and audio metadata
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

Lyrics are read only from embedded lyric tags in audio files; unrelated comments, descriptions, and external sidecar files are not treated as lyrics. Text decoding supports Unicode byte-order marks and detected legacy encodings; lyric rendering supports right-to-left text and falls back to fonts available on the system for non-Latin scripts. Tracks with embedded timestamps are identified as synchronized lyrics.

Use the **Tracks** view to play a track. The web-only `npm start` version cannot scan arbitrary folders on your computer; local-folder access requires Electron.
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
