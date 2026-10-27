const fs = require('node:fs');

function output(decision) {
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}

function collectStrings(value, strings = []) {
  if (typeof value === 'string') {
    strings.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, strings));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
  return strings;
}

function isProtectedCommand(command) {
  const searchableCommand = command.replace(/["'`]/g, '');
  const packageScript =
    /\b(?:npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?(?:release:version(?::check)?|release:notes:create|release:build|electron:build|electron:package)\b/i;
  const directReleaseScript =
    /\bnode(?:\.exe)?\b[^;&|]*\bscripts[\\/](?:set-release-version|create-release-notes)\.js\b/i;
  const electronBuilderCommand = /\belectron-builder\b/i;

  return (
    packageScript.test(searchableCommand) ||
    directReleaseScript.test(searchableCommand) ||
    electronBuilderCommand.test(searchableCommand)
  );
}

let event;
try {
  event = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  output({
    permissionDecision: 'deny',
    permissionDecisionReason: 'Could not validate this Copilot tool call against Luna release safeguards.',
  });
  process.exit(0);
}

const toolName = typeof event.toolName === 'string' ? event.toolName : '';
if (!toolName) {
  output({
    permissionDecision: 'deny',
    permissionDecisionReason: 'Could not identify this Copilot tool call for Luna release safeguards.',
  });
  process.exit(0);
}

const isCommandTool = /terminal|shell|bash|powershell|command|exec|task/i.test(toolName);
const toolArguments = event.toolArgs ?? event.toolInput ?? {};

if (
  isCommandTool &&
  isProtectedCommand(collectStrings(toolArguments).join('\n'))
) {
  output({
    permissionDecision: 'ask',
    permissionDecisionReason:
      'This command changes release metadata or builds/packages Electron. Approve only if the user explicitly requested this release or build action.',
  });
} else {
  output({});
}
