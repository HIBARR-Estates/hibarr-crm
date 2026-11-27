/**
 * A socket event reaches every open tab at once, so "play the chime and show the
 * OS popup" must happen in one of them only. Every tab still updates its own UI.
 *
 * Elected with the Web Locks API: the first tab to take the lock holds it until
 * it closes, then the next waiting tab acquires it. Without Web Locks every tab
 * is its own leader, which is how polling already behaved.
 */

const LOCK_NAME = "crm-notification-alert-leader";

let leader =
    typeof navigator === "undefined" ||
    !("locks" in navigator) ||
    !navigator.locks;
let started = false;

export function startAlertLeaderElection(): void {
    if (started || leader) return;
    started = true;

    navigator.locks
        .request(LOCK_NAME, () => {
            leader = true;
            // Never resolves: the lock is held for the life of the tab.
            return new Promise<void>(() => {});
        })
        .catch(() => {
            leader = true;
        });
}

export function isAlertLeader(): boolean {
    return leader;
}
