# Luna Copilot Instructions

## Release workflow

- Do not run release-version or release-notes scripts for ordinary coding, debugging, testing, or development-server tasks. Do not change the app version or release-note data unless the user explicitly asks to prepare a release.
- When release preparation is explicitly requested, use `npm run release:version` and `npm run release:notes:create` as needed, then write and verify the actual release notes. Do not run `npm run release:build`, Electron build/package commands, or other packaging commands unless the user separately requests a build or package.
- Do not automatically create commits, tags, or GitHub releases.
- `npm run release:version:check` is a read-only preview; run it only as part of explicitly requested release preparation or when the user asks for a version preview.
- The repository hook in `.github/hooks/release-workflow.json` asks for approval before release scripts or Electron packaging commands are run. Do not work around that approval prompt.
