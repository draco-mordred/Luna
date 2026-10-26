const { spawn } = require('node:child_process');
const waitOn = require('wait-on');

const appDirectory = require('node:path').resolve(__dirname, '..');
const reactScripts = require.resolve('react-scripts/scripts/start.js');
const electronCli = require.resolve('electron/cli.js');

const devServer = spawn(process.execPath, [reactScripts], {
  cwd: appDirectory,
  env: { ...process.env, BROWSER: 'none' },
  stdio: 'inherit',
});

let electron;
let shuttingDown = false;
let rejectStartup;
const startupFailure = new Promise((_, reject) => {
  rejectStartup = reject;
});

const stopProcesses = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electron && !electron.killed) electron.kill(signal);
  if (!devServer.killed) devServer.kill(signal);
};

process.on('SIGINT', () => stopProcesses('SIGINT'));
process.on('SIGTERM', () => stopProcesses('SIGTERM'));

devServer.on('error', (error) => {
  console.error('Could not start the React development server:', error);
  rejectStartup(error);
  stopProcesses();
  process.exitCode = 1;
});

devServer.on('exit', (code) => {
  if (!electron && !shuttingDown) {
    const error = new Error(
      `The React development server exited before startup (code ${code ?? 'unknown'}).`
    );
    console.error(error.message);
    rejectStartup(error);
    process.exitCode = code || 1;
  }
});

Promise.race([waitOn({ resources: ['http://localhost:3000'], timeout: 120_000 }), startupFailure])
  .then(() => {
    if (shuttingDown || devServer.exitCode !== null) return;
    electron = spawn(process.execPath, [electronCli, '.'], {
      cwd: appDirectory,
      stdio: 'inherit',
    });
    electron.on('error', (error) => {
      console.error('Could not start Electron:', error);
      process.exitCode = 1;
      stopProcesses();
    });
    electron.on('exit', (code) => {
      process.exitCode = code ?? 0;
      stopProcesses();
    });
  })
  .catch((error) => {
    console.error('Could not launch the Electron development app:', error);
    process.exitCode = 1;
    stopProcesses();
  });
