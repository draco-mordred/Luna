const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const notesDirectory = path.join(projectRoot, 'public', 'release-notes');
const releaseTargets = ['desktop', 'android'];

const compareVersionsDescending = (left, right) => {
  const leftParts = left.version.split('.').map(Number);
  const rightParts = right.version.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return rightParts[index] - leftParts[index];
  }
  return 0;
};

const getSummary = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, 320);

fs.mkdirSync(notesDirectory, { recursive: true });

for (const target of releaseTargets) {
  const notesFileName = `${version}-${target}.txt`;
  const notesPath = path.join(notesDirectory, notesFileName);
  if (fs.existsSync(notesPath)) {
    console.error(`Release notes already exist: public/release-notes/${notesFileName}`);
    process.exit(1);
  }
}

for (const target of releaseTargets) {
  const platformName = target === 'android' ? 'Android' : 'Desktop';
  const notesPath = path.join(notesDirectory, `${version}-${target}.txt`);
  const previousReleasesPath = path.join(notesDirectory, `previous-releases-${target}.json`);
  const legacyPreviousReleasesPath = path.join(notesDirectory, 'previous-releases.json');
  const previousReleases = JSON.parse(
    fs.readFileSync(
      fs.existsSync(previousReleasesPath) ? previousReleasesPath : legacyPreviousReleasesPath,
      'utf8'
    )
  );
  const archivedNotes = fs
    .readdirSync(notesDirectory)
    .filter((fileName) => new RegExp(`^\\d+\\.\\d+\\.\\d+-${target}\\.txt$`).test(fileName))
    .map((fileName) => {
      const archivedVersion = fileName.slice(0, -(target.length + 5));
      if (archivedVersion === version) return null;
      const summary = getSummary(fs.readFileSync(path.join(notesDirectory, fileName), 'utf8'));
      return summary ? { version: archivedVersion, summary } : null;
    })
    .filter(Boolean);
  const summariesByVersion = new Map(previousReleases.map((release) => [release.version, release]));
  archivedNotes.forEach((release) => summariesByVersion.set(release.version, release));

  fs.writeFileSync(
    notesPath,
    `Luna Music ${platformName} v${version}\n\nHighlights\n- [Add release notes here]\n`,
    'utf8'
  );
  fs.writeFileSync(
    previousReleasesPath,
    `${JSON.stringify([...summariesByVersion.values()].sort(compareVersionsDescending), null, 2)}\n`,
    'utf8'
  );
  console.log(`Created public/release-notes/${version}-${target}.txt. Edit it before building.`);
}
