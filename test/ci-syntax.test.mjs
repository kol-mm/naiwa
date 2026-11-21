import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-syntax.mjs', import.meta.url));

test('syntax gate checks every file, not only the first shell glob match', () => {
  const directory = mkdtempSync(join(tmpdir(), 'naiwa-syntax-'));
  try {
    writeFileSync(join(directory, 'a.js'), 'export const a = 1;\n');
    writeFileSync(join(directory, 'b.js'), 'export const b = ;\n');
    const result = spawnSync(process.execPath, [script, directory], {encoding: 'utf8'});
    assert.equal(result.status, 1, 'a valid first file must not hide the broken second file');
    assert.match(result.stderr, /b\.js failed the syntax check/);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('the shipped dist modules all pass the syntax gate', () => {
  const result = spawnSync(process.execPath, [script, 'dist'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Checked \d+ JavaScript files\./);
});
