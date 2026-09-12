import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseStorage } from "../assets/js/storage.js";

describe("database storage", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("opens a writable file handle and autosaves later changes to it", async () => {
        const writable = {
            write: vi.fn().mockResolvedValue(),
            close: vi.fn().mockResolvedValue()
        };
        const handle = {
            name: "lesson.db",
            getFile: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) }),
            queryPermission: vi.fn().mockResolvedValue("granted"),
            createWritable: vi.fn().mockResolvedValue(writable)
        };
        vi.stubGlobal("window", {
            showOpenFilePicker: vi.fn().mockResolvedValue([handle]),
            showSaveFilePicker: vi.fn()
        });
        const BrowserDatabase = { fromBytes: vi.fn().mockResolvedValue({ id: "opened" }) };
        const storage = new DatabaseStorage();

        const database = await storage.openDatabase(BrowserDatabase);
        await storage.autosave({ exportBytes: () => new Uint8Array([4, 5, 6]) });

        expect(database).toEqual({ id: "opened" });
        expect(storage.handle).toBe(handle);
        expect(writable.write).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));
        expect(storage.state.kind).toBe("saved");
    });

    it("writes exported bytes to a connected file handle", async () => {
        const writable = {
            write: vi.fn().mockResolvedValue(),
            close: vi.fn().mockResolvedValue()
        };
        const handle = {
            name: "practice.db",
            queryPermission: vi.fn().mockResolvedValue("granted"),
            createWritable: vi.fn().mockResolvedValue(writable)
        };
        const storage = new DatabaseStorage();
        storage.handle = handle;

        await expect(storage.autosave({ exportBytes: () => new Uint8Array([1, 2, 3]) })).resolves.toBe(true);
        expect(writable.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
        expect(writable.close).toHaveBeenCalledOnce();
        expect(storage.state.kind).toBe("saved");
    });

    it("imports bytes as an unsaved database", async () => {
        const storage = new DatabaseStorage();
        const BrowserDatabase = { fromBytes: vi.fn().mockResolvedValue({ id: "imported" }) };
        const file = { name: "backup.sqlite", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(2)) };

        await expect(storage.importFile(file, BrowserDatabase)).resolves.toEqual({ id: "imported" });
        expect(BrowserDatabase.fromBytes).toHaveBeenCalledOnce();
        expect(storage.handle).toBeNull();
        expect(storage.state.kind).toBe("unsaved");
    });

    it("reports a failed file write and aborts the writable stream", async () => {
        const writable = {
            write: vi.fn().mockRejectedValue(new Error("disk full")),
            close: vi.fn(),
            abort: vi.fn().mockResolvedValue()
        };
        const storage = new DatabaseStorage();
        storage.handle = {
            queryPermission: vi.fn().mockResolvedValue("granted"),
            createWritable: vi.fn().mockResolvedValue(writable)
        };

        await expect(storage.autosave({ exportBytes: () => new Uint8Array([1]) })).rejects.toThrow("disk full");
        expect(writable.abort).toHaveBeenCalledOnce();
        expect(storage.state.kind).toBe("error");
    });
});
