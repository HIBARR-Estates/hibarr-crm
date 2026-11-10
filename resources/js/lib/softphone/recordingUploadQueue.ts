import axios from "axios";

export interface PendingRecording {
    callRef: string;
    blob: Blob;
    duration: number;
    deviceId: string | number | null;
    entityType?: string;
    entityId?: string | number;
    leadName?: string;
    phone: string;
    direction: "inbound" | "outbound";
    routingReason?: string;
    isForwarded?: boolean;
    forwardedFromUserId?: number | string;
    forwardedFromUserName?: string;
    error?: string;
    attempts: number;
    createdAt: number;
    lastAttemptAt?: number;
}

export interface DetailedUploadError {
    reason: string;
    message: string;
    status?: number;
    isRetryable: boolean;
}

const DB_NAME = "hibarr_softphone_recordings";
const STORE_NAME = "pending_uploads";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !window.indexedDB) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        try {
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "callRef" });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                console.warn("[softphone] IndexedDB open error:", req.error);
                resolve(null);
            };
        } catch {
            resolve(null);
        }
    });
}

/** Save a pending recording to local IndexedDB storage. */
export async function savePendingRecording(item: PendingRecording): Promise<void> {
    const db = await openDb();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(item);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

/** Retrieve all pending recordings from local IndexedDB storage. */
export async function getPendingRecordings(): Promise<PendingRecording[]> {
    const db = await openDb();
    if (!db) return [];
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => {
                const results = (req.result as PendingRecording[]) || [];
                // Sort newest first
                results.sort((a, b) => b.createdAt - a.createdAt);
                resolve(results);
            };
            req.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });
}

/** Remove a successfully uploaded recording from local storage. */
export async function removePendingRecording(callRef: string): Promise<void> {
    const db = await openDb();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(callRef);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

/** Update the error message and attempt count for a pending recording. */
export async function updatePendingRecordingError(
    callRef: string,
    error: string,
    attempts: number,
): Promise<void> {
    const db = await openDb();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(callRef);
            getReq.onsuccess = () => {
                const item = getReq.result as PendingRecording | undefined;
                if (item) {
                    item.error = error;
                    item.attempts = attempts;
                    item.lastAttemptAt = Date.now();
                    store.put(item);
                }
                resolve();
            };
            getReq.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

/**
 * Categorise and extract detailed user-facing error explanations from an upload failure.
 */
export function describeUploadError(err: any): DetailedUploadError {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        return {
            reason: "offline",
            message: "Browser is offline (no internet connection)",
            isRetryable: true,
        };
    }
    if (err?.code === "ECONNABORTED" || err?.message?.toLowerCase().includes("timeout")) {
        return {
            reason: "timeout",
            message: "Upload request timed out (connection slow or server unresponsive)",
            isRetryable: true,
        };
    }
    if (!err?.response) {
        return {
            reason: "network_error",
            message: `Network error: ${err?.message || "Failed to reach server"}`,
            isRetryable: true,
        };
    }

    const status: number = err.response.status;
    const data = err.response.data;

    if (status === 413) {
        return {
            reason: "payload_too_large",
            status,
            message: "File exceeds server upload limit (max 50MB)",
            isRetryable: false,
        };
    }
    if (status === 419) {
        return {
            reason: "csrf_expired",
            status,
            message: "CSRF session expired",
            isRetryable: true,
        };
    }
    if (status === 401) {
        return {
            reason: "unauthenticated",
            status,
            message: "User session expired, please refresh or log in",
            isRetryable: false,
        };
    }
    if (status === 403) {
        return {
            reason: "permission_denied",
            status,
            message: data?.message || "Softphone call recording permission denied",
            isRetryable: false,
        };
    }
    if (status === 404) {
        return {
            reason: "not_found",
            status,
            message: data?.message || "Referenced line or entity was not found",
            isRetryable: false,
        };
    }
    if (status === 422) {
        let valError = "";
        if (data?.errors && typeof data.errors === "object") {
            const firstKey = Object.keys(data.errors)[0];
            const messages = data.errors[firstKey];
            if (Array.isArray(messages) && messages.length > 0) {
                valError = `: ${messages[0]}`;
            }
        }
        return {
            reason: "validation_failed",
            status,
            message: `Validation error${valError || (data?.message ? `: ${data.message}` : "")}`,
            isRetryable: false,
        };
    }
    if (status >= 500) {
        return {
            reason: "server_error",
            status,
            message: `Server error (HTTP ${status}): ${data?.message || "Internal server error"}`,
            isRetryable: true,
        };
    }

    return {
        reason: "http_error",
        status,
        message: `HTTP ${status}: ${data?.message || err.message || "Upload request failed"}`,
        isRetryable: status >= 500,
    };
}

function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Execute an upload of a pending recording with automated retries and backoff.
 */
export async function uploadRecordingWithRetries(
    item: PendingRecording,
    options: {
        maxAttempts?: number;
        onProgress?: (attempt: number, max: number) => void;
    } = {},
): Promise<{ success: boolean; playUrl?: string; error?: string; isRetryable?: boolean }> {
    const maxAttempts = options.maxAttempts ?? 3;
    let lastError: DetailedUploadError | null = null;

    const extension = item.blob.type.includes("ogg")
        ? "ogg"
        : "m4a";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (options.onProgress) {
            options.onProgress(attempt, maxAttempts);
        }

        try {
            const form = new FormData();
            form.append("recording", item.blob, `call-${item.createdAt}.${extension}`);
            form.append("duration", String(item.duration));
            if (item.deviceId) {
                form.append("device_id", String(item.deviceId));
            }
            if (item.entityType && item.entityId) {
                form.append("entity_type", item.entityType);
                form.append("entity_id", String(item.entityId));
            }
            if (item.leadName) {
                form.append("lead_name", item.leadName);
            }
            form.append("phone_number", item.phone || "");
            form.append("direction", item.direction);
            if (item.routingReason) {
                form.append("routing_reason", item.routingReason);
            }
            if (item.isForwarded && item.forwardedFromUserId) {
                form.append("is_forwarded", "1");
                form.append("forwarded_from_user_id", String(item.forwardedFromUserId));
                if (item.forwardedFromUserName) {
                    form.append("forwarded_from_user_name", item.forwardedFromUserName);
                }
            }
            if (item.callRef) {
                form.append("call_ref", item.callRef);
            }

            const response = await axios.post(route("call-recordings.store"), form, {
                headers: {
                    "X-CSRF-TOKEN": getCsrfToken(),
                },
                timeout: 60000,
            });

            const playUrl = response.data?.data?.play_url || response.data?.play_url;

            // Successfully uploaded! Remove from local IndexedDB queue
            await removePendingRecording(item.callRef);

            return {
                success: true,
                playUrl,
            };
        } catch (err: any) {
            lastError = describeUploadError(err);
            console.warn(`[softphone] Recording upload attempt ${attempt}/${maxAttempts} failed:`, {
                reason: lastError.reason,
                message: lastError.message,
                callRef: item.callRef,
                attempt,
            });

            if (!lastError.isRetryable || attempt >= maxAttempts) {
                break;
            }

            // Exponential backoff before next retry (2s, 4s, etc.)
            const backoffMs = attempt === 1 ? 2000 : 4000;
            await delay(backoffMs);
        }
    }

    const finalErrorMessage = lastError ? lastError.message : "Upload failed after multiple attempts";

    // Persist failure state in IndexedDB
    await updatePendingRecordingError(item.callRef, finalErrorMessage, maxAttempts);

    // Annotate the backend call event so Call Logs show the exact failure reason
    if (item.callRef) {
        void axios
            .post(route("telephony.softphone.events.store"), {
                phone: item.phone || "",
                event: "call.recording_failed",
                call_ref: item.callRef,
                recording_status: "failed",
                recording_error: finalErrorMessage,
            })
            .catch(() => undefined);
    }

    return {
        success: false,
        error: finalErrorMessage,
        isRetryable: lastError?.isRetryable ?? false,
    };
}
