// indexedDB.js

const DB_NAME = 'ARFitnessDB';
const DB_VERSION = 1;

// Define all object stores and their keyPaths
const STORES = {
  members: { keyPath: 'phone' },
  trainers: { keyPath: 'phone' },
  earnings: { keyPath: 'date' },
  plans: { keyPath: 'id', autoIncrement: true },
  // Add more stores if needed
};

// Open the database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.entries(STORES).forEach(([storeName, options]) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, options);
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save or update an entry
async function saveToDB(storeName, data) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  store.put(data);
  return tx.complete;
}

// Get all entries from a store
async function getAllFromDB(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete entry by key
async function deleteFromDB(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  return tx.complete;
}

// Get a single record by key
async function getFromDB(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
