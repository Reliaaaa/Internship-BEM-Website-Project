const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class TestFile { constructor(size) { this.size = size; this.name = 'test.txt'; } }
const context = vm.createContext({ File: TestFile, Set, Promise, Error, crypto: { randomUUID: () => 'id' } });
vm.runInContext(`${fs.readFileSync('attachments.js', 'utf8')}\nglobalThis.attachments = TaskFlowAttachments;`, context);

test('menolak lampiran lebih dari 5 MiB sebelum membuka IndexedDB', async () => {
  await assert.rejects(context.attachments.save(new TestFile(5 * 1024 * 1024 + 1)), /maksimal 5 MB/);
});

test('hapus daftar kosong tidak membuka IndexedDB', async () => {
  await context.attachments.removeMany([null, undefined]);
});
