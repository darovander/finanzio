/* db.js — Finanzio database layer (IndexedDB) */

const DB_NAME = 'FinanzioDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('transactions')) {
        const ts = d.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        ts.createIndex('type', 'type');
        ts.createIndex('date', 'date');
        ts.createIndex('category', 'category');
      }
      if (!d.objectStoreNames.contains('super_items')) {
        d.createObjectStore('super_items', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('super_history')) {
        d.createObjectStore('super_history', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('budget')) {
        d.createObjectStore('budget', { keyPath: 'category' });
      }
      if (!d.objectStoreNames.contains('reminders')) {
        d.createObjectStore('reminders', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

async function dbGetAll(storeName) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(storeName, item) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    let newId;
    const req = tx.objectStore(storeName).add(item);
    req.onsuccess = () => { newId = req.result; };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(newId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbPut(storeName, item) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(item);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbDelete(storeName, key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbGet(storeName, key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbClear(storeName) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getSetting(key, defaultVal = null) {
  try {
    const row = await dbGet('settings', key);
    return (row && row.value !== undefined && row.value !== null) ? row.value : defaultVal;
  } catch {
    return defaultVal;
  }
}

async function setSetting(key, value) {
  try {
    await dbPut('settings', { key, value });
  } catch (e) {
    console.error('setSetting error:', key, e);
    throw e;
  }
}
