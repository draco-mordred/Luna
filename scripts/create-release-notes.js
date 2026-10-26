const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const notesDirectory = path.join(projectRoot, 'public', 'release-notes');
const notesPath = path.join(notesDirectory, `${version}.txt`);

if (fs.existsSync(notesPath)) {
  console.error(`Release notes already exist: public/release-notes/${version}.txt`);
  process.exit(1);
}

fs.mkdirSync(notesDirectory, { recursive: true });
fs.writeFileSync(
  notesPath,
  `Luna Music v${version}\n\nHighlights\n- [Add release notes here]\n`,
  'utf8'
);
const previousReleasesPath = path.join(notesDirectory, 'previous-releases.json');
const previousReleases = JSON.parse(fs.readFileSync(previousReleasesPath, 'utf8'));
const archivedNotes = fs
  .readdirSync(notesDirectory)
  .filter((fileName) => /^\d+\.\d+\.\d+\.txt$/.test(fileName))
  .map((fileName) => {
    const archivedVersion = fileName.slice(0, -4);
    if (archivedVersion === version) return null;
    const text = fs.readFileSync(path.join(notesDirectory, fileName), 'utf8');
    const highlights = text
      .split(/\r?\n/)
      .filter((line) => /^-\s+/.test(line))
      .map((line) => line.replace(/^-\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (highlights.length === 0) return null;
    return {
      version: archivedVersion,
      summary: highlights.join(' ').slice(0, 320),
    };
  })
  .filter(Boolean);
const summariesByVersion = new Map(previousReleases.map((release) => [release.version, release]));
archivedNotes.forEach((release) => summariesByVersion.set(release.version, release));
const compareVersionsDescending = (left, right) => {
  const leftParts = left.version.split('.').map(Number);
  const rightParts = right.version.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return rightParts[index] - leftParts[index];
  }
  return 0;
};
fs.writeFileSync(
  previousReleasesPath,
  `${JSON.stringify([...summariesByVersion.values()].sort(compareVersionsDescending), null, 2)}\n`,
  'utf8'
);
console.log(`Created public/release-notes/${version}.txt. Edit it before building.`);
