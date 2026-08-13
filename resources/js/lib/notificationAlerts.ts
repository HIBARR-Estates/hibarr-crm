/**
 * Sound + desktop-popup alerts for newly arrived in-app notifications.
 * Pure browser-API helpers — no React, no hook state.
 */

const MUTE_STORAGE_KEY = "notification_alerts_muted";
const NOTCH_POSITION_STORAGE_KEY = "notification_notch_position";
const NOTCH_DURATION_STORAGE_KEY = "notification_notch_duration";

/** Peak gain for the notification chime (Web Audio 0–1 scale). */
const NOTIFICATION_SOUND_PEAK_GAIN = 0.35;

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;

    if (!sharedAudioContext) {
        sharedAudioContext = new Ctor();
    }
    return sharedAudioContext;
}

/**
 * Plays one tone of the chime: a short sine beep with a quick fade-out so it
 * doesn't click at the end.
 */
function playTone(ctx: AudioContext, startAt: number, frequency: number, duration: number): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(
        NOTIFICATION_SOUND_PEAK_GAIN,
        startAt + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
}

export function isAlertsMuted(): boolean {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
}

export function setAlertsMuted(muted: boolean): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
}

export type NotchPosition =
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";

const NOTCH_POSITIONS: NotchPosition[] = [
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
];

const DEFAULT_NOTCH_POSITION: NotchPosition = "top-center";
const DEFAULT_NOTCH_DURATION_MS = 4200;
export const NOTCH_DURATIONS_MS = [3000, 4200, 6000] as const;

export function getNotchPosition(): NotchPosition {
    if (typeof window === "undefined") return DEFAULT_NOTCH_POSITION;
    const stored = window.localStorage.getItem(NOTCH_POSITION_STORAGE_KEY);
    return (NOTCH_POSITIONS as string[]).includes(stored ?? "")
        ? (stored as NotchPosition)
        : DEFAULT_NOTCH_POSITION;
}

export function setNotchPosition(position: NotchPosition): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(NOTCH_POSITION_STORAGE_KEY, position);
}

export function getNotchDurationMs(): number {
    if (typeof window === "undefined") return DEFAULT_NOTCH_DURATION_MS;
    const stored = Number(window.localStorage.getItem(NOTCH_DURATION_STORAGE_KEY));
    return (NOTCH_DURATIONS_MS as readonly number[]).includes(stored)
        ? stored
        : DEFAULT_NOTCH_DURATION_MS;
}

export function setNotchDurationMs(durationMs: number): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(NOTCH_DURATION_STORAGE_KEY, String(durationMs));
}

const ISLAND_SEEN_IDS_KEY = "notification_island_seen_ids";
const ISLAND_SEEN_IDS_MAX = 500;

let islandSeenIdsMemory: Set<string> | null = null;

function readIslandSeenIds(): Set<string> {
    if (islandSeenIdsMemory) return islandSeenIdsMemory;
    if (typeof window === "undefined") {
        islandSeenIdsMemory = new Set();
        return islandSeenIdsMemory;
    }
    try {
        const raw = window.sessionStorage.getItem(ISLAND_SEEN_IDS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        islandSeenIdsMemory = new Set(
            Array.isArray(parsed) ? parsed.map(String) : [],
        );
    } catch {
        islandSeenIdsMemory = new Set();
    }
    return islandSeenIdsMemory;
}

function writeIslandSeenIds(ids: Set<string>): void {
    islandSeenIdsMemory = ids;
    if (typeof window === "undefined") return;
    try {
        const values = Array.from(ids);
        const trimmed =
            values.length > ISLAND_SEEN_IDS_MAX
                ? values.slice(values.length - ISLAND_SEEN_IDS_MAX)
                : values;
        window.sessionStorage.setItem(
            ISLAND_SEEN_IDS_KEY,
            JSON.stringify(trimmed),
        );
    } catch {
        // sessionStorage full/blocked — memory set still prevents duplicates.
    }
}

/** True if this notification already triggered an island (or was seeded as seen). */
export function hasIslandAlreadyShown(notificationId: string): boolean {
    return readIslandSeenIds().has(notificationId);
}

/** Mark a notification so its island will not display again this session. */
export function markIslandAlreadyShown(notificationId: string): void {
    const ids = readIslandSeenIds();
    if (ids.has(notificationId)) return;
    ids.add(notificationId);
    writeIslandSeenIds(ids);
}

/**
 * Seed current unread IDs without alerting, or return only never-seen ones and
 * mark them. Accumulates across polls (does not shrink to the current window).
 */
export function takeUnseenNotifications<T extends { id: string }>(
    notifications: T[],
): T[] {
    const seen = readIslandSeenIds();
    // First call in this JS realm with an empty memory set that also had no
    // session entries still needs a "seed" pass — callers detect first paint
    // via a module flag in the hook. Here we only filter + accumulate.
    const unseen = notifications.filter((n) => !seen.has(n.id));
    if (unseen.length === 0) return [];
    for (const n of unseen) {
        seen.add(n.id);
    }
    writeIslandSeenIds(seen);
    return unseen;
}

/** Seed IDs as already-seen (used on first poll so existing unread don't alert). */
export function seedIslandSeenNotifications(
    notifications: Array<{ id: string }>,
): void {
    const seen = readIslandSeenIds();
    let changed = false;
    for (const n of notifications) {
        if (!seen.has(n.id)) {
            seen.add(n.id);
            changed = true;
        }
    }
    if (changed) writeIslandSeenIds(seen);
}

// ── Dropdown badge: count only notifications arrived since last open ──

const DROPDOWN_ACK_IDS_KEY = "notification_dropdown_acknowledged_ids";
const DROPDOWN_ACK_IDS_MAX = 500;

let dropdownAckIdsMemory: Set<string> | null = null;

function readDropdownAckIds(): Set<string> {
    if (dropdownAckIdsMemory) return dropdownAckIdsMemory;
    if (typeof window === "undefined") {
        dropdownAckIdsMemory = new Set();
        return dropdownAckIdsMemory;
    }
    try {
        const raw = window.sessionStorage.getItem(DROPDOWN_ACK_IDS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        dropdownAckIdsMemory = new Set(
            Array.isArray(parsed) ? parsed.map(String) : [],
        );
    } catch {
        dropdownAckIdsMemory = new Set();
    }
    return dropdownAckIdsMemory;
}

function writeDropdownAckIds(ids: Set<string>): void {
    dropdownAckIdsMemory = ids;
    if (typeof window === "undefined") return;
    try {
        const values = Array.from(ids);
        const trimmed =
            values.length > DROPDOWN_ACK_IDS_MAX
                ? values.slice(values.length - DROPDOWN_ACK_IDS_MAX)
                : values;
        window.sessionStorage.setItem(
            DROPDOWN_ACK_IDS_KEY,
            JSON.stringify(trimmed),
        );
    } catch {
        // sessionStorage full/blocked — memory set still works for this tab.
    }
}

/** Mark current dropdown items as seen so the bell badge clears. */
export function acknowledgeDropdownNotifications(
    notifications: Array<{ id: string }>,
): void {
    const ack = readDropdownAckIds();
    let changed = false;
    for (const n of notifications) {
        if (!ack.has(n.id)) {
            ack.add(n.id);
            changed = true;
        }
    }
    if (changed) writeDropdownAckIds(ack);
}

/** Bell badge: unread items the user has not opened the dropdown for yet. */
export function countUnacknowledgedNotifications(
    notifications: Array<{ id: string }>,
): number {
    const ack = readDropdownAckIds();
    return notifications.reduce(
        (count, n) => (ack.has(n.id) ? count : count + 1),
        0,
    );
}

export function playNotificationSound(): void {
    if (isAlertsMuted()) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        // Browsers suspend AudioContext until a user gesture happens on the
        // page; resume() is a no-op once that's already occurred.
        void ctx.resume().catch(() => {});

        const now = ctx.currentTime;
        playTone(ctx, now, 880, 0.12);
        playTone(ctx, now + 0.14, 1108.73, 0.16);
    } catch {
        // Web Audio unsupported/blocked in this environment; ignore.
    }
}

export function isDesktopNotificationSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopPermission(): NotificationPermission | "unsupported" {
    if (!isDesktopNotificationSupported()) return "unsupported";
    return Notification.permission;
}

/**
 * Must be called from a user gesture (click) — browsers silently auto-deny
 * permission requests fired without one.
 */
export async function requestDesktopPermission(): Promise<NotificationPermission> {
    if (!isDesktopNotificationSupported()) return "denied";
    return Notification.requestPermission();
}

/** Island-style icon for OS desktop notification popups only (not the app tab favicon). */
const DESKTOP_NOTIFICATION_ICON = "/notification-icon.svg";

export function showDesktopNotification(
    title: string,
    body: string,
    link?: string | null
): void {
    if (isAlertsMuted()) return;
    if (!isDesktopNotificationSupported()) return;
    if (Notification.permission !== "granted") return;
    // Redundant with the in-app bell while the tab is focused — only pop
    // outside the browser when the user isn't already looking at the CRM.
    if (typeof document !== "undefined" && !document.hidden) return;

    try {
        const popup = new Notification(title, {
            body,
            icon: DESKTOP_NOTIFICATION_ICON,
            tag: link ?? undefined,
        });

        popup.onclick = () => {
            window.focus();
            if (link) {
                window.location.href = link;
            }
            popup.close();
        };
    } catch {
        // Some browsers (e.g. Chrome Android) throw Illegal constructor.
    }
}
