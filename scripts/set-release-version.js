const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const START_YEAR = 2026;
const START_MONTH = 10;
const MAX_MONTHLY_RELEASE_INDEX = 19;

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  }

  const [, yearText, monthText, dayText] = match;
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  if (
    date.getFullYear() !== Number(yearText) ||
    date.getMonth() + 1 !== Number(monthText) ||
    date.getDate() !== Number(dayText)
  ) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  return date;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Version "${version}" is not a numeric three-part version.`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3],
  };
}

function dateFromPatch(patch) {
  const code = patch.padStart(6, '0');
  if (code.length !== 6) return null;

  const day = Number(code.slice(0, 2));
  const month = Number(code.slice(2, 4));
  const year = 2000 + Number(code.slice(4, 6));
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function getReleaseDate(args) {
  const dateIndex = args.indexOf('--date');
  if (dateIndex === -1) return new Date();
  if (!args[dateIndex + 1]) {
    throw new Error('Pass a date after --date using YYYY-MM-DD.');
  }
  return parseDate(args[dateIndex + 1]);
}

function getNextVersion(date, currentVersion, tags) {
  const monthOffset =
    (date.getFullYear() - START_YEAR) * 12 + date.getMonth() + 1 - START_MONTH;
  if (monthOffset < 0) {
    throw new Error('Release date is earlier than the configured start month, 2026-10.');
  }

  const major = monthOffset + 1;
  const current = parseVersion(currentVersion);
  const releaseIndexes = new Set();

  for (const tag of tags) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);
    if (!match || Number(match[1]) !== major) continue;

    const minor = Number(match[2]);
    const taggedDate = dateFromPatch(match[3]);
    if (taggedDate) {
      if (
        taggedDate.getFullYear() !== date.getFullYear() ||
        taggedDate.getMonth() !== date.getMonth()
      ) {
        throw new Error(`Release tag "${tag}" has a date that does not match its monthly version.`);
      }
      releaseIndexes.add(minor);
      continue;
    }

    if (major === 1 && minor === 0) {
      releaseIndexes.add(0);
      continue;
    }
    throw new Error(`Release tag "${tag}" does not use the DDMMYY release date format.`);
  }

  const currentDate = dateFromPatch(current.patch);
  const currentIsFirstMonthRelease =
    major === 1 &&
    current.major === 1 &&
    ((current.minor === 0 && currentDate === null) ||
      (current.minor > 0 &&
        currentDate !== null &&
        currentDate.getFullYear() === date.getFullYear() &&
        currentDate.getMonth() === date.getMonth()));
  if (currentIsFirstMonthRelease) releaseIndexes.add(0);

  const lastPublishedIndex = releaseIndexes.size
    ? Math.max(...releaseIndexes)
    : -1;
  let nextIndex = lastPublishedIndex + 1;

  const currentIsUnpublishedCandidate =
    current.major === major &&
    current.minor === nextIndex &&
    currentDate !== null &&
    currentDate.getFullYear() === date.getFullYear() &&
    currentDate.getMonth() === date.getMonth();
  if (currentIsUnpublishedCandidate) nextIndex = current.minor;

  if (nextIndex > MAX_MONTHLY_RELEASE_INDEX) {
    throw new Error(
      `All 20 release numbers for ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')} have been used.`
    );
  }

  const dateCode = [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()).slice(-2),
  ].join('');

  return `${major}.${nextIndex}.${Number(dateCode)}`;
}

function main() {
  const packagePath = path.join(PROJECT_ROOT, 'package.json');
  const lockPath = path.join(PROJECT_ROOT, 'package-lock.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const tags = execFileSync('git', ['tag', '--list'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const date = getReleaseDate(process.argv.slice(2));
  const version = getNextVersion(date, packageJson.version, tags);

  if (process.argv.includes('--dry-run')) {
    console.log(`Next release version: ${version}`);
    return;
  }

  packageJson.version = version;
  packageLock.version = version;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = version;
  }
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  fs.writeFileSync(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  console.log(`Release version set to ${version}.`);
}

try {
  main();
} catch (error) {
  console.error(`Could not set release version: ${error.message}`);
  process.exitCode = 1;
}
