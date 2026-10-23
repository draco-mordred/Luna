# Luna Music Player

A minimal, beautiful music player app with Apple Music and Samsung Music inspired UI. Runs on **Electron (desktop)** and **Capacitor (mobile)**.

## Features

- Apple Music layout with Samsung Music "Now Playing" interface
- Bottom-positioned draggable PlayBar
- Expands to full "Now Playing" view
- Displays album art with default fallback
- Playback controls: Previous, Play/Pause, Next, Volume
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
