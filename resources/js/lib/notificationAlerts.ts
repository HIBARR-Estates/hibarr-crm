/**
 * Sound + desktop-popup alerts for newly arrived in-app notifications.
 * Pure browser-API helpers — no React, no hook state.
 */

const MUTE_STORAGE_KEY = "notification_alerts_muted";

/** Peak gain for the notification chime (Web Audio 0–1 scale). */
const NOTIFICATION_SOUND_PEAK_GAIN = 1;

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

    const popup = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: link ?? undefined,
    });

    popup.onclick = () => {
        window.focus();
        if (link) {
            window.location.href = link;
        }
        popup.close();
    };
}
