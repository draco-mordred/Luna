<p align="center">
  <img src="public/icon.png" alt="Luna Music icon" width="120" />
</p>

<h1 align="center">Luna Music</h1>

<p align="center">
  Your music library, beautifully at home on your desktop.
</p>

<p align="center">
  <a href="https://github.com/draco-mordred/Luna/releases/latest">
    <img src="https://img.shields.io/github/v/release/draco-mordred/Luna?style=for-the-badge&color=7857D6&label=Latest%20release" alt="Latest GitHub release" />
  </a>
  <a href="https://github.com/draco-mordred/Luna/releases">
    <img src="https://img.shields.io/github/downloads/draco-mordred/Luna/total?style=for-the-badge&color=7857D6&label=Downloads" alt="GitHub release downloads" />
  </a>
  <a href="LICENSE.md">
    <img src="https://img.shields.io/github/license/draco-mordred/Luna?style=for-the-badge&color=7857D6" alt="MIT License" />
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#download">Download</a> ·
  <a href="#privacy-and-online-services">Privacy</a> ·
  <a href="https://github.com/draco-mordred/Luna/issues">Support</a>
</p>

Luna is a music player for enjoying a personal music collection in a clean, customizable interface. Browse local tracks and albums, explore artist details, and move from a compact PlayBar to a full Now Playing view with lyrics and visualizations. Luna runs as a desktop app and can also be run in a web browser. The Electron desktop app scans selected folders; the Android app scans audio indexed by Android's media library.

## Features

- **Your local library:** Scan music folders, browse tracks and albums, and organize your listening with search, playlists, shuffle, repeat, and a play queue.
- **A player that stays close:** Keep playback in the bottom PlayBar or expand it into Now Playing. The player adapts to different window sizes and supports mouse and touch interactions.
- **Lyrics your way:** Display embedded plain or timestamped lyrics, switch between plain and synchronized modes, and choose whether lyric visibility stays in sync between the PlayBar and Now Playing.
- **Personalized playback:** Choose themes, accent colors, transport icon styles, seek bar designs, and audio visualizer styles.
- **Rich track details:** View album artwork and metadata, edit supported audio tags and embedded lyrics, and explore artist images and biographies.
- **Discover more music:** Connect to Jamendo or Audiomack for online catalog search and streaming. These integrations may require API credentials and are subject to each provider's access rules and terms.
- **Desktop integration:** On Windows, use playback controls from the taskbar preview and install Luna through the branded setup wizard.
- **Responsive layouts:** Use Luna in a desktop window or a narrower mobile-sized layout.

## Screenshots

<p align="center">
  <img src="screenshots/tracks.png" alt="Desktop library with the Tracks view and bottom PlayBar" width="49%" />
  <img src="screenshots/albums.png" alt="Desktop library with album artwork cards" width="49%" />
</p>
<p align="center">
  <img src="screenshots/album-tracklist.png" alt="Album details and track list" width="49%" />
  <img src="screenshots/lyrics-synced.png" alt="Now Playing with synchronized lyrics" width="49%" />
</p>
<p align="center">
  <img src="screenshots/tracks-mobile.png" alt="Luna library and player in a narrow layout" width="32%" />
  <img src="screenshots/albums-mobile.png" alt="Luna albums in a narrow layout" width="32%" />
  <img src="screenshots/nowplaying-mobile.png" alt="Luna Now Playing in a narrow layout" width="32%" />
</p>

## Download

<p align="center">
  <a href="https://github.com/draco-mordred/Luna/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest%20Windows%20Installer-7857D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download the latest Windows installer" />
  </a>
</p>

Visit [GitHub Releases](https://github.com/draco-mordred/Luna/releases/latest) and download **`Luna Setup <version>.exe`** for Windows. The installer includes a language selector, a dark branded setup wizard, and an option to choose the installation folder. It can replace an existing Luna installation while preserving app settings and library data.

## Getting started

1. Download and run the Windows installer from the [latest release](https://github.com/draco-mordred/Luna/releases/latest).
2. On first launch, select one or more folders containing your music.
3. Browse your library and start listening. Customize the app from **Settings**.

Luna indexes supported audio files in selected folders. In the desktop app, right-click a track to edit supported metadata and embedded lyrics. Changes are written to the audio file itself. MP3, FLAC, M4A/MP4, and OGG/OGA files support metadata editing; other supported library formats may still be playable.

## Privacy and online services

Your local music library is indexed on your device. Online features are optional and use third-party services:

- Artist images and biographies may be looked up through the English Wikipedia API and Wikimedia Commons.
- Jamendo and Audiomack search and playback use their respective APIs and are subject to provider terms, access requirements, and licensing.

Audiomack streaming requires authorized OAuth credentials and is available in the Electron desktop app. Jamendo requires a Client ID. Review each provider's terms and obtain any required permissions before using or distributing those integrations. Luna does not bundle music from these services.

## Building from source

### Requirements

- Node.js and npm
- Windows for building the Windows installer
- For Android: Android Studio, Android SDK Platform 34 or newer, and JDK 17

### Run the desktop app in development

```bash
npm install
npm run dev
```

### Build the production app and installers

```bash
npm run electron:build
```

The Windows installer is written to `dist/`. Its filename includes the app version from `package.json`. To make a build available to users, publish a GitHub Release and attach the installer executable as a release asset rather than committing the large binary to the repository.

### Build and run the Android app

The Android project uses Capacitor and needs Android Studio, the Android SDK, and JDK 17. Open the generated native project in Android Studio:

```bash
npm run android:sync
npm run android:open
```

Select an emulator or connected Android device in Android Studio and run the app. On its first library scan, Luna asks for Android audio access and lists audio files indexed by Android's media library. The app currently uses the platform's media permission and system-managed `content://` audio URIs. Background playback, lock-screen/media-session controls, and Play Store signing/release setup remain follow-up Android work.

Android `versionName` follows `package.json`. Its Play Store `versionCode` is derived separately from Luna's month/release/date version fields to remain an increasing integer; Android Play Store releases are not ready until signing and background playback are completed.



Fetch tags before creating a later release, then build:

```bash
git fetch origin --tags
npm run release:build
```

Each version needs a plain-text file at `public/release-notes/<version>.txt`. When preparing a release, add the completed change and bug-fix summary to this file; the app shows it on the first launch of that version, followed by brief summaries from `public/release-notes/previous-releases.json`, and remembers when the dialog is dismissed. Creating a new release notes file also refreshes previous-version summaries from archived notes. The build checks that the current version's notes exist and are not left as the starter placeholder. To start a notes file after updating the version, run `npm run release:notes:create`, then edit the generated file before building.

The release build updates `package.json` and `package-lock.json`, then builds the Electron installers. If the version was advanced and its notes file is not ready, create and complete that file, then run `npm run electron:build`. It does not create a Git commit, tag, or GitHub Release; commit the version change and notes, create and push a matching `v<version>` tag, and attach the installer from `dist/` to a GitHub Release. For a preview without changing files, use `npm run release:version:check`.

## Support

Found a problem or have a feature request? [Open an issue](https://github.com/draco-mordred/Luna/issues).

## License

Luna is distributed under the [MIT License](LICENSE.md).

<!-- TODO: Add a project website or product landing page if one is created. -->

<!-- TODO: Add a privacy-policy link before promoting Luna as a privacy-focused product. -->

<!-- TODO: Publish the v1.0.1 GitHub Release with the Windows installer attached. -->
