const DB_NAME = "cambridge-dbml-storage";
const STORE_NAME = "handles";
const HANDLE_KEY = "active-database";

function supportsFileSystemAccess() {
    return typeof window !== "undefined" && typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function";
}

function fileName(handle) {
    return handle?.name || "database.db";
}

function openHandleStore() {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveHandle(handle) {
    let db = null;
    try {
        db = await openHandleStore();
        if (!db) return;
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (_error) {
        // The external file remains usable when optional IndexedDB storage fails.
    } finally {
        db?.close();
    }
}

async function loadHandle() {
    const db = await openHandleStore();
    if (!db) return null;
    const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
}

export class DatabaseStorage {
    constructor(onStateChange = () => {}) {
        this.handle = null;
        this.onStateChange = onStateChange;
        this.setState("In-memory only", "in-memory");
    }

    setState(label, kind, detail = "") {
        this.state = { label, kind, detail };
        this.onStateChange(this.state);
    }

    hasFileSystemAccess() { return supportsFileSystemAccess(); }

    async restoreHandle(BrowserDatabase) {
        if (!supportsFileSystemAccess()) return null;
        try {
            const handle = await loadHandle();
            if (!handle || typeof handle.queryPermission !== "function") return null;
            if (await handle.queryPermission({ mode: "readwrite" }) !== "granted") return null;
            const file = await handle.getFile();
            this.handle = handle;
            const database = await BrowserDatabase.fromBytes(await file.arrayBuffer());
            this.setState(`Saved to ${fileName(handle)}`, "saved");
            return database;
        } catch (error) {
            this.setState("In-memory only", "in-memory", `Could not reconnect to the previous database: ${error.message}`);
            return null;
        }
    }

    async openDatabase(BrowserDatabase) {
        if (!supportsFileSystemAccess()) throw new Error("This browser does not support direct file opening. Use Import Database instead.");
        const [handle] = await window.showOpenFilePicker({ types: [{ description: "SQLite database", accept: { "application/x-sqlite3": [".sqlite", ".db", ".sqlite3"] } }], multiple: false });
        const file = await handle.getFile();
        const database = await BrowserDatabase.fromBytes(await file.arrayBuffer());
        this.handle = handle;
        await saveHandle(handle);
        this.setState(`Saved to ${fileName(handle)}`, "saved");
        return database;
    }

    async saveAs(database) {
        if (!supportsFileSystemAccess()) throw new Error("Direct file saving is not available in this browser. Use Export Database instead.");
        const handle = await window.showSaveFilePicker({ suggestedName: "cambridge-practice.db", types: [{ description: "SQLite database", accept: { "application/x-sqlite3": [".sqlite", ".db", ".sqlite3"] } }] });
        this.handle = handle;
        await saveHandle(handle);
        await this.write(database);
    }

    async write(database) {
        if (!this.handle) {
            this.setState("Unsaved changes", "unsaved");
            return false;
        }
        this.setState(`Saving to ${fileName(this.handle)}…`, "saving");
        let writable = null;
        try {
            if (await this.handle.queryPermission({ mode: "readwrite" }) !== "granted") {
                if (await this.handle.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Write permission was not granted.");
            }
            writable = await this.handle.createWritable();
            await writable.write(database.exportBytes());
            await writable.close();
            this.setState(`Saved to ${fileName(this.handle)}`, "saved");
            return true;
        } catch (error) {
            try { await writable?.abort?.(); } catch (_abortError) { /* preserve save error */ }
            this.setState("Save failed", "error", error.message);
            throw error;
        }
    }

    async autosave(database) {
        if (!this.handle) {
            this.setState("Unsaved changes — export or save a file to keep them", "unsaved");
            return false;
        }
        return this.write(database);
    }

    async importFile(file, BrowserDatabase) {
        const database = await BrowserDatabase.fromBytes(await file.arrayBuffer());
        this.handle = null;
        this.setState(`Imported ${file.name}; unsaved changes`, "unsaved");
        return database;
    }

    exportDatabase(database) {
        const blob = new Blob([database.exportBytes()], { type: "application/x-sqlite3" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "cambridge-practice.db";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        this.setState("Exported database copy", "saved", "A downloaded file is a permanent copy outside browser storage.");
    }
}

export { supportsFileSystemAccess };
