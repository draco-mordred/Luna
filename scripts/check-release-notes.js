const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const notesPath = path.join(projectRoot, 'public', 'release-notes', `${version}.txt`);
const previousNotesPath = path.join(
  projectRoot,
  'public',
  'release-notes',
  'previous-releases.json'
);

if (!fs.existsSync(notesPath)) {
  console.error(
    `Missing release notes for ${version}: create public/release-notes/${version}.txt before building.`
  );
  process.exit(1);
}

const notes = fs.readFileSync(notesPath, 'utf8').trim();
if (!notes || notes.includes('[Add release notes here]')) {
  console.error(`Release notes for ${version} are empty or still contain the starter placeholder.`);
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
  console.error('public/release-notes/previous-releases.json must contain version summaries.');
  process.exit(1);
}

console.log(`Release notes found for ${version}.`);
