const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { Transform, pipeline } = require('stream');
const extractZip = require('extract-zip');

const PLATFORM_TOOLS_URLS = {
  win32: 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
  darwin: 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
  linux: 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip',
};
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const isAllowedDownloadHost = (hostname) =>
  hostname === 'google.com' ||
  hostname.endsWith('.google.com') ||
  hostname === 'gvt1.com' ||
  hostname.endsWith('.gvt1.com');

const downloadArchive = (url, destinationPath, onProgress, redirects = 0) =>
  new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    if (requestUrl.protocol !== 'https:' || !isAllowedDownloadHost(requestUrl.hostname)) {
      reject(new Error('Platform Tools download redirected to an untrusted host.'));
      return;
    }

    const request = https.get(requestUrl, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.resume();
        if (!location || redirects >= MAX_REDIRECTS) {
          reject(new Error('Platform Tools download exceeded the redirect limit.'));
          return;
        }
        downloadArchive(
          new URL(location, requestUrl).toString(),
          destinationPath,
          onProgress,
          redirects + 1
        )
          .then(resolve)
          .catch(reject);
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`Platform Tools download failed with HTTP ${status}.`));
        return;
      }

      const totalBytes = Number(response.headers['content-length']) || null;
      if (totalBytes !== null && totalBytes > MAX_ARCHIVE_BYTES) {
        response.destroy();
        reject(new Error('The Platform Tools archive exceeds the download size limit.'));
        return;
      }

      let downloadedBytes = 0;
      onProgress?.({ phase: 'downloading', downloadedBytes, totalBytes });
      const sizeLimiter = new Transform({
        transform(chunk, _encoding, callback) {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_ARCHIVE_BYTES) {
            callback(new Error('The Platform Tools archive exceeds the download size limit.'));
            return;
          }
          onProgress?.({ phase: 'downloading', downloadedBytes, totalBytes });
          callback(null, chunk);
        },
      });
      const output = fs.createWriteStream(destinationPath, { flags: 'wx' });
      pipeline(response, sizeLimiter, output, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    request.setTimeout(30000, () => {
      request.destroy(new Error('Platform Tools download timed out.'));
    });
    request.on('error', reject);
  });

const runExecutable = (executable, args) =>
  new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message).trim()));
          return;
        }
        resolve(stdout);
      }
    );
  });

const pathExists = async (targetPath) => {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const installPlatformTools = async ({
  platform = process.platform,
  destinationDirectory,
  onProgress,
}) => {
  const downloadUrl = PLATFORM_TOOLS_URLS[platform];
  if (!downloadUrl) {
    throw new Error(`Android Platform Tools are not available for ${platform}.`);
  }
  if (typeof destinationDirectory !== 'string' || !path.isAbsolute(destinationDirectory)) {
    throw new TypeError('An absolute Platform Tools installation directory is required.');
  }

  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'luna-platform-tools-')
  );
  const archivePath = path.join(temporaryDirectory, 'platform-tools.zip');
  const extractionDirectory = path.join(temporaryDirectory, 'extracted');
  const stagedToolsDirectory = path.join(extractionDirectory, 'platform-tools');
  const executableName = platform === 'win32' ? 'adb.exe' : 'adb';
  const stagedAdbPath = path.join(stagedToolsDirectory, executableName);
  const backupDirectory = `${destinationDirectory}.backup-${crypto.randomUUID()}`;
  let destinationBackedUp = false;

  try {
    await downloadArchive(downloadUrl, archivePath, onProgress);
    onProgress?.({ phase: 'extracting', downloadedBytes: 0, totalBytes: null });
    await fs.promises.mkdir(extractionDirectory, { recursive: true });
    await extractZip(archivePath, { dir: extractionDirectory });

    if (!(await pathExists(stagedAdbPath))) {
      throw new Error('The downloaded Platform Tools archive does not contain ADB.');
    }
    if (platform !== 'win32') {
      await fs.promises.chmod(stagedAdbPath, 0o755);
      const fastbootPath = path.join(stagedToolsDirectory, 'fastboot');
      if (await pathExists(fastbootPath)) await fs.promises.chmod(fastbootPath, 0o755);
    }

    onProgress?.({ phase: 'verifying', downloadedBytes: 0, totalBytes: null });
    await runExecutable(stagedAdbPath, ['version']);
    await fs.promises.mkdir(path.dirname(destinationDirectory), { recursive: true });
    if (await pathExists(destinationDirectory)) {
      await fs.promises.rename(destinationDirectory, backupDirectory);
      destinationBackedUp = true;
    }

    try {
      await fs.promises.rename(stagedToolsDirectory, destinationDirectory);
      await runExecutable(path.join(destinationDirectory, executableName), ['version']);
    } catch (error) {
      await fs.promises.rm(destinationDirectory, { recursive: true, force: true });
      if (destinationBackedUp) {
        await fs.promises.rename(backupDirectory, destinationDirectory);
        destinationBackedUp = false;
      }
      throw error;
    }

    if (destinationBackedUp) {
      await fs.promises.rm(backupDirectory, { recursive: true, force: true });
      destinationBackedUp = false;
    }
    return path.join(destinationDirectory, executableName);
  } finally {
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
};

module.exports = { installPlatformTools };
