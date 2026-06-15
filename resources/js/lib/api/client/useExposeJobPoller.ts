import { useEffect, useRef } from "react";
import axios from "axios";

export type ExposeJobStatus = "queued" | "processing" | "ready" | "failed";

export const formatExposeElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins === 0) {
        return `${secs}s`;
    }

    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

export const exposeJobStatusLabel = (status: ExposeJobStatus | null) => {
    switch (status) {
        case "queued":
            return "Queued — waiting for a worker";
        case "processing":
            return "Generating PDF";
        default:
            return "Preparing your expose";
    }
};

interface JobStatusResponse {
    id: number;
    status: ExposeJobStatus;
    filename: string;
    download_url: string | null;
    error_message: string | null;
    expires_at: string | null;
}

interface UseExposeJobPollerOptions {
    jobId: number | null;
    onReady: (downloadUrl: string, filename: string) => void;
    onError: (message: string) => void;
    onStatusChange?: (status: ExposeJobStatus) => void;
    intervalMs?: number;
}

/**
 * Polls /account/expose-jobs/{id} until the job is ready or failed.
 * Stops polling automatically when jobId is null or when the component unmounts.
 */
export function useExposeJobPoller({
    jobId,
    onReady,
    onError,
    onStatusChange,
    intervalMs = 3000,
}: UseExposeJobPollerOptions): void {
    const timerRef = useRef<number | undefined>(undefined);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!jobId) return;

        const poll = async () => {
            try {
                const response = await axios.get<{
                    data: JobStatusResponse;
                }>(`/account/expose-jobs/${jobId}`);

                if (!isMountedRef.current) return;

                const job = response.data?.data;

                if (job?.status) {
                    onStatusChange?.(job.status);
                }

                if (job?.status === "ready" && job.download_url) {
                    onReady(job.download_url, job.filename);
                } else if (job?.status === "failed") {
                    onError(job.error_message ?? "PDF generation failed.");
                } else {
                    timerRef.current = window.setTimeout(poll, intervalMs);
                }
            } catch {
                if (isMountedRef.current) {
                    onError("Failed to check expose job status.");
                }
            }
        };

        timerRef.current = window.setTimeout(poll, intervalMs);

        return () => {
            if (timerRef.current !== undefined) {
                clearTimeout(timerRef.current);
            }
        };
    }, [jobId, intervalMs, onError, onReady, onStatusChange]);
}
