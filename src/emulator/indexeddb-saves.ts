/**
 * IndexedDB — Persistência de saves do emulador 3ds-web.
 *
 * Distingue dois tipos de persistência, ambos armazenados exclusivamente
 * no navegador do usuário (client-side). Nunca são transmitidos a servidor
 * algum.
 *
 * 1. Save Game (savegame): arquivos salvos pelo jogo no VFS (/azahar/save).
 *    Chaveado pelo caminho do arquivo no VFS.
 * 2. Save State (estado): snapshots de slot criados pelo usuário.
 *    Chaveado por [userId, slot].
 */

const DB_NAME = 'zelda-web-saves';
const DB_VERSION = 1;

interface StoredSaveState {
  userId: string;
  slot: number;
  data: ArrayBuffer;
  timestamp: number;
  title: string | null;
}

export class IndexedDBSaves {
  private db: IDBDatabase | null = null;
  private userId: string;

  constructor(userId: string = 'default') {
    this.userId = userId;
  }

  async open(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('savegames')) {
          db.createObjectStore('savegames', { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains('savestates')) {
          db.createObjectStore('savestates', { keyPath: ['userId', 'slot'] });
        }
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ========================================================================
  // Save Game — arquivos do VFS (/azahar/save)
  // ========================================================================

  async saveGameFile(path: string, data: ArrayBuffer): Promise<void> {
    await this.open();
    const store = this.db!.transaction('savegames', 'readwrite').objectStore('savegames');
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ path, data, timestamp: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async loadGameFile(path: string): Promise<ArrayBuffer | null> {
    await this.open();
    const store = this.db!.transaction('savegames', 'readonly').objectStore('savegames');
    return new Promise<ArrayBuffer | null>((resolve, reject) => {
      const req = store.get(path);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  }

  async listSaveGames(): Promise<string[]> {
    await this.open();
    const store = this.db!.transaction('savegames', 'readonly').objectStore('savegames');
    return new Promise<string[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteGameFile(path: string): Promise<void> {
    await this.open();
    const store = this.db!.transaction('savegames', 'readwrite').objectStore('savegames');
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(path);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ========================================================================
  // Save State — snapshots de slot
  // ========================================================================

  async saveState(slot: number, data: ArrayBuffer, title: string | null): Promise<void> {
    await this.open();
    const store = this.db!.transaction('savestates', 'readwrite').objectStore('savestates');
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ userId: this.userId, slot, data, timestamp: Date.now(), title });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async loadState(slot: number): Promise<{ data: ArrayBuffer; title: string | null; timestamp: number } | null> {
    await this.open();
    const store = this.db!.transaction('savestates', 'readonly').objectStore('savestates');
    return new Promise<{ data: ArrayBuffer; title: string | null; timestamp: number } | null>((resolve, reject) => {
      const req = store.get([this.userId, slot]);
      req.onsuccess = () => {
        if (!req.result) resolve(null);
        else resolve({ data: req.result.data, title: req.result.title, timestamp: req.result.timestamp });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async listSaveStates(): Promise<{ slot: number; title: string | null; timestamp: number }[]> {
    await this.open();
    const store = this.db!.transaction('savestates', 'readonly').objectStore('savestates');
    return new Promise<{ slot: number; title: string | null; timestamp: number }[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as StoredSaveState[]).filter((r) => r.userId === this.userId);
        resolve(results.map((r) => ({ slot: r.slot, title: r.title, timestamp: r.timestamp })));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteState(slot: number): Promise<void> {
    await this.open();
    const store = this.db!.transaction('savestates', 'readwrite').objectStore('savestates');
    await new Promise<void>((resolve, reject) => {
      const req = store.delete([this.userId, slot]);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const indexeddbSaves = new IndexedDBSaves();
