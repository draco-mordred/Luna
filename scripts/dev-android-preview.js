const { spawn } = require('node:child_process');
const path = require('node:path');

const appDirectory = path.resolve(__dirname, '..');
const reactScripts = require.resolve('react-scripts/scripts/start.js');
const port = process.env.ANDROID_PREVIEW_PORT || '3001';
const devServer = spawn(process.execPath, [reactScripts], {
  cwd: appDirectory,
  env: {
    ...process.env,
    PORT: port,
    REACT_APP_ANDROID_PREVIEW: '1',
  },
  stdio: 'inherit',
});

const stopServer = (signal) => {
  if (!devServer.killed) devServer.kill(signal);
};

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));

devServer.on('error', (error) => {
  console.error('Could not start the Android preview development server:', error);
  process.exitCode = 1;
});

devServer.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
