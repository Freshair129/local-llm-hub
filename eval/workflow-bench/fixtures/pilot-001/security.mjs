import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./slugify.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(source, /\beval\s*\(/);
assert.doesNotMatch(source, /\bnew\s+Function\b/);
assert.doesNotMatch(source, /from\s+['"]node:(child_process|vm)['"]/);
console.log('pilot security checks passed');
