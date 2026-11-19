// Files live in IndexedDB to avoid localStorage's small capacity.
const TaskFlowAttachments = (() => {
  const limit = 5 * 1024 * 1024;

  function open() {
    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open('TaskFlowAttachmentsDB', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('attachments', { keyPath: 'id' });
      request.onsuccess = () => blocked ? request.result.close() : resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Penyimpanan lampiran tidak tersedia.'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Penyimpanan lampiran sedang digunakan oleh tab lain.'));
      };
    });
  }

  async function transact(mode, operation) {
    const database = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction('attachments', mode);
        const result = operation(transaction.objectStore('attachments'));
        transaction.oncomplete = () => resolve(result?.result);
        transaction.onerror = () => reject(transaction.error || new Error('Gagal mengakses lampiran.'));
        transaction.onabort = () => reject(transaction.error || new Error('Operasi lampiran dibatalkan.'));
      });
    } finally {
      database.close();
    }
  }

  return {
    async save(file) {
      if (!(file instanceof File)) throw new Error('Pilih berkas yang valid.');
      if (file.size > limit) throw new Error('Ukuran lampiran maksimal 5 MB.');
      const record = { id: crypto.randomUUID(), name: file.name, blob: file };
      await transact('readwrite', (store) => store.add(record));
      return { id: record.id, name: record.name };
    },
    get(id) {
      return transact('readonly', (store) => store.get(id));
    },
    removeMany(ids) {
      const uniqueIds = [...new Set(ids.filter(Boolean))];
      if (!uniqueIds.length) return Promise.resolve();
      return transact('readwrite', (store) => {
        for (const id of uniqueIds) store.delete(id);
      });
    }
  };
})();
