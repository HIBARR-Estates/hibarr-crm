export const BUILD_VERSION_URL = "/build-version.json";

const DEFAULT_INTERVAL_MS = 90_000;

export async function fetchLiveBuildId(): Promise<string | null> {
    try {
        const response = await fetch(BUILD_VERSION_URL, {
            cache: "no-store",
            credentials: "same-origin",
        });
        if (!response.ok) {
            return null;
        }
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("id" in data)) {
            return null;
        }
        const id = (data as { id: unknown }).id;
        return typeof id === "string" && id !== "" ? id : null;
    } catch {
        return null;
    }
}

export async function hardRefresh(): Promise<void> {
    try {
        await fetch(window.location.href, {
            cache: "reload",
            credentials: "same-origin",
        });
    } catch {
        // Document fetch is best-effort; still reload.
    }
    window.location.reload();
}

export type StaleBuildWatcherOptions = {
    bootId: string | null | undefined;
    onStale: () => void;
    intervalMs?: number;
};

/**
 * Compares the id the page booted with against /build-version.json.
 * Stops after the first mismatch. No-op when bootId is empty.
 */
export function startStaleBuildWatcher({
    bootId,
    onStale,
    intervalMs = DEFAULT_INTERVAL_MS,
}: StaleBuildWatcherOptions): () => void {
    const id = typeof bootId === "string" ? bootId.trim() : "";
    if (!id) {
        return () => undefined;
    }

    let stopped = false;
    let inFlight = false;
    let intervalHandle: number | undefined;

    const teardown = () => {
        if (intervalHandle !== undefined) {
            window.clearInterval(intervalHandle);
            intervalHandle = undefined;
        }
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", onVisible);
    };

    const check = async () => {
        if (stopped || inFlight) {
            return;
        }
        if (document.visibilityState !== "visible") {
            return;
        }
        inFlight = true;
        try {
            const liveId = await fetchLiveBuildId();
            if (stopped) {
                return;
            }
            if (liveId && liveId !== id) {
                stopped = true;
                teardown();
                onStale();
            }
        } finally {
            inFlight = false;
        }
    };

    const onVisible = () => {
        if (document.visibilityState === "visible") {
            void check();
        }
    };

    intervalHandle = window.setInterval(() => {
        void check();
    }, intervalMs);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    void check();

    return () => {
        stopped = true;
        teardown();
    };
}
