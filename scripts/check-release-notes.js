const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const notesDirectory = path.join(projectRoot, 'public', 'release-notes');

for (const target of ['desktop', 'android']) {
  const notesPath = path.join(notesDirectory, `${version}-${target}.txt`);
  const previousNotesPath = path.join(notesDirectory, `previous-releases-${target}.json`);

  if (!fs.existsSync(notesPath)) {
    console.error(
      `Missing ${target} release notes for ${version}: create public/release-notes/${version}-${target}.txt before building.`
    );
    process.exit(1);
  }
  if (!fs.existsSync(previousNotesPath)) {
    console.error(
      `Missing ${target} release history: create public/release-notes/previous-releases-${target}.json before building.`
    );
    process.exit(1);
  }

  const notes = fs.readFileSync(notesPath, 'utf8').trim();
  if (!notes || notes.includes('[Add release notes here]')) {
    console.error(
      `${target} release notes for ${version} are empty or still contain the starter placeholder.`
    );
    process.exit(1);
  }

  const previousReleases = JSON.parse(fs.readFileSync(previousNotesPath, 'utf8'));
  if (
    !Array.isArray(previousReleases) ||
    !previousReleases.every(
      (release) =>
        release &&
        typeof release.version === 'string' &&
        typeof release.summary === 'string' &&
        release.summary.trim()
    )
  ) {
    console.error(
      `public/release-notes/previous-releases-${target}.json must contain version summaries.`
    );
    process.exit(1);
  }
}

console.log(`Desktop and Android release notes found for ${version}.`);
