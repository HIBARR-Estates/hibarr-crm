// Run with: node --experimental-strip-types --test resources/js/__tests__/contactSla.test.mts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    formatClock,
    formatDurationShort,
    isLive,
    serverOffsetMs,
    slaView,
    type ContactSla,
} from "../Pages/Leads/Redesign/adapters/contactSla.ts";

const NOW = Date.parse("2026-11-25T10:00:00Z");

function sla(over: Partial<ContactSla> = {}): ContactSla {
    return {
        id: 1,
        lead_entry_id: 1,
        status: "running",
        first_contact_seconds: 600,
        recommended_method: "call",
        window: null,
        owner: { id: 5, name: "Ada" },
        started_at: "2026-11-25T09:55:00Z",
        due_at: "2026-11-25T10:05:00Z",
        paused: false,
        resumes_at: null,
        breached: false,
        breached_at: null,
        contacted_at: null,
        contact_method: null,
        contacted_by: null,
        used_recommended_method: null,
        elapsed_working_seconds: null,
        met_in_time: null,
        server_now: "2026-11-25T10:00:00Z",
        ...over,
    };
}

describe("slaView", () => {
    test("waits for an owner before anything counts", () => {
        assert.deepEqual(slaView(sla({ status: "awaiting_owner", due_at: null }), NOW), {
            phase: "awaiting_owner",
            seconds: 0,
        });
    });

    test("counts down to the deadline", () => {
        assert.deepEqual(slaView(sla(), NOW), { phase: "running", seconds: 300 });
    });

    test("is due soon in the last quarter of the limit", () => {
        // 150s is exactly a quarter of 600s.
        assert.equal(slaView(sla(), Date.parse("2026-11-25T10:02:30Z")).phase, "due_soon");
        assert.equal(slaView(sla(), Date.parse("2026-11-25T10:02:29Z")).phase, "running");
    });

    test("is overdue at the deadline and counts how long past it", () => {
        assert.deepEqual(slaView(sla(), Date.parse("2026-11-25T10:05:00Z")), { phase: "overdue", seconds: 0 });
        assert.deepEqual(slaView(sla(), Date.parse("2026-11-25T10:07:30Z")), { phase: "overdue", seconds: 150 });
    });

    test("with working hours the countdown is the working time left, not the wall-clock distance", () => {
        // 16h away on the wall clock, but only 540 working seconds left at the server's clock.
        const windowed = sla({
            window: { timezone: "UTC", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
            due_at: "2026-11-26T09:05:00Z",
            remaining_working_seconds: 540,
        });
        assert.deepEqual(slaView(windowed, NOW), { phase: "running", seconds: 540 });
        // It ticks down from the server's moment.
        assert.equal(slaView(windowed, NOW + 60_000).seconds, 480);
        // It is never shown as zero before the deadline passes: the next refresh says what happened.
        assert.equal(slaView(windowed, NOW + 600_000).seconds, 1);
    });

    test("stops deducting when the working window closes, until the next refresh says paused", () => {
        // 310 working seconds left at 16:59:50; the window closes at 17:00:00.
        const closing = sla({
            window: { timezone: "UTC", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
            server_now: "2026-11-27T16:59:50Z",
            due_at: "2026-11-30T09:05:00Z",
            remaining_working_seconds: 310,
            window_closes_at: "2026-11-27T17:00:00Z",
        });
        const at = (iso: string) => Date.parse(iso);

        assert.equal(slaView(closing, at("2026-11-27T16:59:55Z")).seconds, 305);
        // Ten seconds after the close, only the ten seconds before it were working time.
        assert.equal(slaView(closing, at("2026-11-27T17:00:10Z")).seconds, 300);
        assert.equal(slaView(closing, at("2026-11-27T17:05:00Z")).seconds, 300);
    });

    test("without working hours the countdown is the plain distance to the deadline", () => {
        assert.deepEqual(slaView(sla({ remaining_working_seconds: null }), NOW), { phase: "running", seconds: 300 });
    });

    test("shows paused outside working hours, but an overdue clock is late whatever the hour", () => {
        assert.equal(slaView(sla({ paused: true }), NOW).phase, "paused");
        assert.equal(slaView(sla({ paused: true }), Date.parse("2026-11-25T10:06:00Z")).phase, "overdue");
    });

    test("reports a clock that ended in time or late, with the time taken", () => {
        const inTime = sla({ status: "met", met_in_time: true, elapsed_working_seconds: 192 });
        const late = sla({ status: "met", met_in_time: false, elapsed_working_seconds: 723 });
        assert.deepEqual(slaView(inTime, NOW), { phase: "met", seconds: 192 });
        assert.deepEqual(slaView(late, NOW), { phase: "met_late", seconds: 723 });
    });

    test("treats a running clock with no deadline as the full limit", () => {
        assert.deepEqual(slaView(sla({ due_at: null }), NOW), { phase: "running", seconds: 600 });
    });
});

describe("serverOffsetMs", () => {
    test("is how far the server's clock is ahead of the browser's", () => {
        assert.equal(serverOffsetMs({ server_now: "2026-11-25T10:00:05Z" }, NOW), 5000);
        assert.equal(serverOffsetMs({ server_now: "2026-11-25T09:59:50Z" }, NOW), -10000);
        assert.equal(serverOffsetMs({ server_now: "garbage" }, NOW), 0);
    });
});

describe("formatClock", () => {
    test("is mm:ss under an hour and Hh MMm from an hour", () => {
        assert.equal(formatClock(0), "00:00");
        assert.equal(formatClock(272), "04:32");
        assert.equal(formatClock(3599), "59:59");
        assert.equal(formatClock(3600), "1h 00m");
        assert.equal(formatClock(7500), "2h 05m");
    });

    test("never goes negative", () => {
        assert.equal(formatClock(-5), "00:00");
    });
});

describe("formatDurationShort", () => {
    test("uses the shortest exact units", () => {
        assert.equal(formatDurationShort(45), "45s");
        assert.equal(formatDurationShort(300), "5m");
        assert.equal(formatDurationShort(192), "3m 12s");
        assert.equal(formatDurationShort(5400), "1h 30m");
        assert.equal(formatDurationShort(7200), "2h");
    });
});

describe("isLive", () => {
    test("an ended clock stops ticking and polling", () => {
        assert.equal(isLive(sla()), true);
        assert.equal(isLive(sla({ status: "awaiting_owner" })), true);
        assert.equal(isLive(sla({ status: "met" })), false);
    });
});
