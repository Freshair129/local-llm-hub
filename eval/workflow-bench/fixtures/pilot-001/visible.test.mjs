import assert from 'node:assert/strict';
import { slugifyModelName } from './slugify.mjs';

assert.equal(slugifyModelName('Mellum 2.1 Thinking'), 'mellum-2-1-thinking');
assert.equal(slugifyModelName('  Qwen__Coder  '), 'qwen-coder');
assert.equal(slugifyModelName('42'), '42');
console.log('visible workflow pilot checks passed');
