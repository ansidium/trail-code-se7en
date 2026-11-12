import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentGuard } from '../src/skills/risk.js';
import { isReadOnlyPowerShellHash } from '../src/trace/shell.js';

// Reproduce the classifier's Windows stdin diagnostic without reading or
// executing any hook. The paths are synthetic and the command is just data.
const HASH = [
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  "const crypto = require('node:crypto');",
  "const roots = ['C:/fixture/repo', 'C:/fixture/installed'];",
  "const files = ['dist/claude/pre-bash.js', 'dist/claude/pre-bash-check.js'];",
  "let ok = true;",
  "for (const root of roots) {",
  " const p = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));",
  " console.log(JSON.stringify({root, name:p.name, version:p.version, repository:p.repository, bin:p.bin}));",
  " if(p.name !== 'trail-code-se7en' || p.version !== '0.29.0') ok=false;",
  "}",
  "for (const file of files) {",
  " const hashes = roots.map(function(root) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); });",
  " const equal = hashes.every(function(hash) { return hash === hashes[0]; });",
  " console.log(JSON.stringify({file, equal, sha256:hashes[0]}));",
  " if(!equal) ok=false;",
  "}",
  "const lock = JSON.parse(fs.readFileSync('C:/fixture/package-lock.json', 'utf8'));",
  "console.log(JSON.stringify({npxPackage: lock.packages['node_modules/trail-code-se7en']}));",
  "console.log(JSON.stringify({result:ok?'PASS':'FAIL',files:files.length,copies:roots.length}));",
  "if(!ok) process.exitCode=1;",
].join('\n');

const stdin = (body: string) => "@'\n" + body + "\n'@ | node -";
const diagnostic = "trail --version; graft --version; node 'C:\\fixture\\dist\\bin\\trail.js' --version; " + stdin(HASH);

test('literal Windows SHA256 diagnostic reads files without running a hook', () => {
  for (const command of [stdin(HASH), diagnostic, diagnostic.replaceAll('\n', '\r\n')]) {
    assert.equal(isReadOnlyPowerShellHash(command), true);
    assert.equal(agentGuard(command, true), null);
  }
  assert.equal(agentGuard(diagnostic)?.hit, 'hook-script', 'an unspecified shell retains the previous guard');
});

test('PowerShell hash recognition requires the entire non-interpolated command', () => {
  for (const command of [
    stdin(HASH).replace("@'\n", '@"\n').replace("\n'@", '\n"@'),
    stdin(HASH).replace('node -', 'node --require ./dist/claude/pre-bash.js -'),
    stdin(HASH) + ' > hashes.txt',
    stdin(HASH) + '; node ./dist/claude/pre-bash.js',
  ]) {
    assert.equal(isReadOnlyPowerShellHash(command), false);
    assert.equal(agentGuard(command, true)?.hit, 'hook-script');
  }
});

test('adding an unproved operation to the diagnostic does not allow it', () => {
  for (const operation of [
    "require('./dist/claude/pre-bash.js');",
    "fs.writeFileSync('dist/claude/pre-bash.js', '');",
    "const unapproved = require('fixture-module');",
    "const malformed = ;",
  ]) {
    const command = stdin(HASH + '\n' + operation);
    assert.equal(isReadOnlyPowerShellHash(command), false);
    assert.equal(agentGuard(command, true)?.hit, 'hook-script');
  }
  assert.equal(agentGuard(diagnostic + '; trail skills on', true)?.hit, 'skills-on');
});
