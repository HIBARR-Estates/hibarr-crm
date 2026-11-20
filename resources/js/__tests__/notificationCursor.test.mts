// Run with: node --experimental-strip-types --test resources/js/__tests__/notificationCursor.test.mts
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNotificationCursorStore } from "../lib/realtime/notificationCursor.ts";

class MemoryStorage {
    private data = new Map<string, string>();
    getItem(key: string) {
        return this.data.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.data.set(key, value);
    }
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    (globalThis as any).window = { sessionStorage: storage };
});

describe("cursor", () => {
    test("starts empty", () => {
        assert.equal(createNotificationCursorStore(1).getCursor(), null);
    });

    test("only ever moves forward", () => {
        const store = createNotificationCursorStore(1);

        store.advance("2026-11-19T10:00:10+00:00");
        store.advance("2026-11-19T10:00:05+00:00");
        store.advance("not a date");
        store.advance(null);

        assert.equal(store.getCursor(), "2026-11-19T10:00:10+00:00");

        store.advance("2026-11-19T10:00:30+00:00");
        assert.equal(store.getCursor(), "2026-11-19T10:00:30+00:00");
    });

    test("survives a page load, so a reload does not lose the gap", () => {
        createNotificationCursorStore(1).advance("2026-11-19T10:00:10+00:00");

        assert.equal(
            createNotificationCursorStore(1).getCursor(),
            "2026-11-19T10:00:10+00:00",
        );
    });

    test("is kept per user, so impersonation never shares a position", () => {
        createNotificationCursorStore(1).advance("2026-11-19T10:00:10+00:00");

        assert.equal(createNotificationCursorStore(2).getCursor(), null);
    });
});

describe("applied ids", () => {
    test("a notification applied once is recognised again after a reload", () => {
        const first = createNotificationCursorStore(1);
        first.markApplied("abc");

        assert.equal(first.hasApplied("abc"), true);
        assert.equal(first.hasApplied("other"), false);
        assert.equal(createNotificationCursorStore(1).hasApplied("abc"), true);
    });

    test("stays bounded", () => {
        const store = createNotificationCursorStore(1);
        for (let i = 0; i < 260; i++) store.markApplied(`id-${i}`);

        assert.equal(store.hasApplied("id-0"), false);
        assert.equal(store.hasApplied("id-259"), true);

        const persisted = JSON.parse(
            storage.getItem("notification_stream_applied_1") as string,
        );
        assert.equal(persisted.length, 200);
    });

    test("works without sessionStorage (blocked or full)", () => {
        (globalThis as any).window = {
            get sessionStorage() {
                throw new Error("blocked");
            },
        };

        const store = createNotificationCursorStore(1);
        store.markApplied("abc");
        store.advance("2026-11-19T10:00:10+00:00");

        assert.equal(store.hasApplied("abc"), true);
        assert.equal(store.getCursor(), "2026-11-19T10:00:10+00:00");
    });
});
