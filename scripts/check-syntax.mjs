import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const directory = resolve(process.argv[2] || 'dist');
const files = readdirSync(directory)
  .filter(file => file.endsWith('.js'))
  .sort();

if (!files.length) {
  console.error(`No JavaScript files found in ${directory}`);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const path = resolve(directory, file);
  const source = readFileSync(path, 'utf8');
  // dist is ESM. `node --check file.js` can skip module syntax depending on
  // Node's detection and the cwd, so feed the source explicitly as a module.
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: source,
    encoding: 'utf8',
  });
  if (result.status === 0) continue;
  failed = true;
  process.stderr.write(`${file} failed the syntax check\n${result.stderr || result.stdout || ''}`);
}

if (failed) process.exit(1);
console.log(`Checked ${files.length} JavaScript files.`);
