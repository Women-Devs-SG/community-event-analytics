import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// CI does not make commits; downloaded source archives may have no Git metadata.
if (process.env.CI || !existsSync(new URL('../.git', import.meta.url))) {
  console.log('Skipping local Git hook setup (CI or source archive).');
  process.exit(0);
}

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const current = git('config', '--get', 'core.hooksPath');
if (current.error || (current.status !== 0 && current.status !== 1)) {
  console.error('Could not read Git hook configuration.', current.error?.message ?? current.stderr);
  process.exit(1);
}

if (current.status === 0 && current.stdout.trim() !== '.githooks') {
  console.warn('Keeping your existing core.hooksPath. Integrate npm run check:commit into your existing pre-commit hook.');
  process.exit(0);
}

// A fresh checkout on Unix needs an executable hook even if committed from Windows.
chmodSync(new URL('../.githooks/pre-commit', import.meta.url), 0o755);
const result = git('config', '--local', 'core.hooksPath', '.githooks');
if (result.error || result.status !== 0) {
  console.error('Could not install Git hooks.', result.error?.message ?? result.stderr);
  process.exit(1);
}
console.log('Pre-commit checks enabled for this checkout.');
