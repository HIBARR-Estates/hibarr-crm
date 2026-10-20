/**
 * Cross-tab single-instance guard for the in-browser softphone.
 *
 * Every open tab used to register its own SIP UserAgent on the same device.
 * That made the provider ring all tabs at once, and answering in one tab raced
 * the others — which surfaced as phantom sessions being terminated
 * ("session terminated call-2" while "answer() start call-1") and duplicate
 * `call_started` timeline rows.
 *
 * Only the tab holding the lease registers. The others stay passive: they do
 * not register, do not ring, and do not accept. The lease is handed over
 * automatically when the owning tab goes away (crash/close) via a heartbeat.
 */

const CHANNEL_NAME = "hibarr.softphone.lease";
const STORAGE_KEY = "hibarr.softphone.lease.owner";
const HEARTBEAT_MS = 2000;
const STALE_MS = 6000;

type LeaseMessage =
    | { type: "claim"; tabId: string; at: number }
    | { type: "heartbeat"; tabId: string; at: number }
    | { type: "release"; tabId: string }
    // Broadcast by the owning tab so passive tabs can mirror call state.
    | { type: "call"; tabId: string; call: unknown | null };

type Listener = (isOwner: boolean, mirroredCall: unknown | null) => void;

function tabId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Total order over tab ids. Ids embed a base36 timestamp prefix, so a plain
 * string compare already orders oldest-first; this just makes that explicit and
 * keeps it stable if the id format ever changes.
 */
function outranks(mine: string, theirs: string): boolean {
    if (theirs === "") {
        return true;
    }
    if (mine === theirs) {
        return false;
    }
    return mine < theirs;
}

export class SoftphoneTabLease {
    private readonly id = tabId();
    private channel: BroadcastChannel | null = null;
    private heartbeatTimer: number | null = null;
    private listeners = new Set<Listener>();
    private owner = false;
    private lastSeenAt = 0;
    /**
     * Id of the most recently seen owner, used to pick a single deterministic
     * successor when that owner goes away. Null before any owner is seen.
     */
    private lastReleasedOwnerId: string | null = null;

    constructor() {
        if (typeof window === "undefined") {
            return;
        }

        try {
            this.channel = new BroadcastChannel(CHANNEL_NAME);
            this.channel.addEventListener("message", this.onMessage);
        } catch {
            // BroadcastChannel unsupported — fall back to storage-only locking.
            this.channel = null;
        }

        window.addEventListener("storage", this.onStorage);
        window.addEventListener("pagehide", this.release);
        window.addEventListener("beforeunload", this.release);
    }

    /** True when this tab is the one that should register the SIP agent. */
    get isOwner(): boolean {
        return this.owner;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.owner, null);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Try to become the owning tab. Resolves to true when this tab holds the
     * lease (either immediately or after the previous owner went away).
     */
    async acquire(): Promise<boolean> {
        if (typeof window === "undefined") {
            return true;
        }

        const current = this.readOwner();
        if (!current || current.id === this.id) {
            this.becomeOwner();
            return true;
        }

        if (this.isStale(current)) {
            // Previous owner crashed without releasing; take over.
            this.becomeOwner();
            return true;
        }

        // Another tab is alive and owning. Announce ourselves and let the owner
        // answer; if it never does (tab frozen), fall back after the stale window.
        this.post({ type: "claim", tabId: this.id, at: Date.now() });

        return new Promise<boolean>((resolve) => {
            const deadline = Date.now() + STALE_MS;
            const poll = () => {
                if (this.owner) {
                    resolve(true);
                    return;
                }
                const owner = this.readOwner();
                if (!owner || this.isStale(owner)) {
                    this.becomeOwner();
                    resolve(true);
                    return;
                }
                if (Date.now() >= deadline) {
                    resolve(false);
                    return;
                }
                window.setTimeout(poll, 250);
            };
            window.setTimeout(poll, 250);
        });
    }

    /** Mirror the active call from the owning tab so passive tabs can display it. */
    broadcastCall(call: unknown | null): void {
        this.post({ type: "call", tabId: this.id, call });
    }

    release = (): void => {
        if (this.heartbeatTimer !== null) {
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
        if (this.owner) {
            // Remember who left so the passive tabs can agree on one successor.
            this.lastReleasedOwnerId = this.id;
            this.post({ type: "release", tabId: this.id });
        }
        this.owner = false;
        this.notify();
    };

    dispose(): void {
        this.release();
        this.channel?.removeEventListener("message", this.onMessage);
        window.removeEventListener("storage", this.onStorage);
        window.removeEventListener("pagehide", this.release);
        window.removeEventListener("beforeunload", this.release);
        this.listeners.clear();
        this.channel?.close();
        this.channel = null;
    }

    // ── internals ────────────────────────────────────────────────────────

    private becomeOwner(): void {
        if (!this.owner) {
            this.owner = true;
            this.lastSeenAt = Date.now();
            this.notify();
        }

        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ id: this.id, at: Date.now() }),
            );
        } catch {
            // ignore
        }

        if (this.heartbeatTimer === null) {
            this.heartbeatTimer = window.setInterval(() => {
                this.lastSeenAt = Date.now();
                this.post({ type: "heartbeat", tabId: this.id, at: this.lastSeenAt });
                try {
                    window.localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({ id: this.id, at: this.lastSeenAt }),
                    );
                } catch {
                    // ignore
                }
            }, HEARTBEAT_MS);
        }
    }

    private onMessage = (event: MessageEvent): void => {
        const message = event.data as LeaseMessage | undefined;
        if (!message || message.tabId === this.id) {
            return;
        }

        switch (message.type) {
            case "heartbeat":
                if (!this.owner) {
                    this.lastSeenAt = message.at;
                } else if (outranks(message.tabId, this.id)) {
                    // A higher-priority tab is alive and claiming the lease;
                    // step down rather than fight it for the SIP registration.
                    this.stepDown();
                }
                break;
            case "release":
                if (!this.owner) {
                    // Owner went away cleanly — take over so the line keeps
                    // ringing. Every passive tab hears this message, so only the
                    // lowest-priority one claims; otherwise they all become owner
                    // at once and re-create the duplicate-registration bug.
                    if (this.preferredPassiveTab()) {
                        this.becomeOwner();
                    }
                }
                break;
            case "claim":
                if (this.owner) {
                    // Reassert ownership so the claimant backs off.
                    this.becomeOwner();
                }
                break;
            case "call":
                if (!this.owner) {
                    this.notify(message.call ?? null);
                }
                break;
        }
    };

    private onStorage = (event: StorageEvent): void => {
        if (event.key === STORAGE_KEY && !this.owner) {
            const owner = this.readOwner();
            // Same single-owner rule as the `release` message: the owner row is
            // gone, but every passive tab sees it, so only the preferred one
            // takes over.
            if ((!owner || this.isStale(owner)) && this.preferredPassiveTab()) {
                this.becomeOwner();
            }
        }
    };

    /**
     * True when this tab should be the next owner among the passive tabs.
     *
     * There is no shared view of "which passive tabs exist", so this compares
     * the recorded owner id against ours: the tab that sorts before the
     * outgoing owner wins, which keeps a single deterministic claimant instead
     * of every passive tab promoting itself.
     *
     * When the released owner was the oldest (lowest id), no tab outranks it.
     * In that case, fall back to a hash-based arbitration so exactly one
     * successor can still claim ownership and the line keeps ringing.
     */
    private preferredPassiveTab(): boolean {
        const previous = this.lastReleasedOwnerId;
        if (previous === null) return true;
        if (outranks(this.id, previous)) return true;

        // Previous owner was the oldest — use a deterministic hash to pick
        // exactly one successor. The hash is based on the previous owner id,
        // so all tabs compute the same value and agree on who should take over.
        const previousHash = this.hashCode(previous);
        const myHash = this.hashCode(this.id);
        return myHash < previousHash;
    }

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /** Give up ownership without clearing another tab's claim. */
    private stepDown(): void {
        if (this.heartbeatTimer !== null) {
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (!this.owner) {
            return;
        }
        this.owner = false;
        this.notify();
    }

    private post(message: LeaseMessage): void {
        try {
            this.channel?.postMessage(message);
        } catch {
            // ignore
        }
    }

    private readOwner(): { id: string; at: number } | null {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw) as { id: string; at: number };
            if (typeof parsed?.id !== "string") {
                return null;
            }
            // Track the incumbent so a later take-over can be arbitrated against
            // a real id rather than falling back to "everyone claims".
            if (parsed.id !== this.id) {
                this.lastReleasedOwnerId = parsed.id;
            }

            return parsed;
        } catch {
            return null;
        }
    }

    private isStale(owner: { id: string; at: number }): boolean {
        const lastBeat = Math.max(owner.at, this.lastSeenAt);
        return Date.now() - lastBeat > STALE_MS;
    }

    private notify(mirroredCall: unknown | null = null): void {
        this.listeners.forEach((listener) => listener(this.owner, mirroredCall));
    }
}
