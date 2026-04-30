import { useEffect, useRef } from "react";
import axios from "axios";

type JobStatus = "queued" | "processing" | "ready" | "failed";

interface JobStatusResponse {
    id: number;
    status: JobStatus;
    filename: string;
    download_url: string | null;
    error_message: string | null;
    expires_at: string | null;
}

interface UseExposeJobPollerOptions {
    jobId: number | null;
    onReady: (downloadUrl: string, filename: string) => void;
    onError: (message: string) => void;
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

                if (job?.status === "ready" && job.download_url) {
                    onReady(job.download_url, job.filename);
                } else if (job?.status === "failed") {
                    onError(job.error_message ?? "PDF generation failed.");
                } else {
                    // queued or processing — schedule next poll
                    timerRef.current = window.setTimeout(poll, intervalMs);
                }
            } catch {
                if (isMountedRef.current) {
                    onError("Failed to check expose job status.");
                }
            }
        };

        // First poll after a short initial delay
        timerRef.current = window.setTimeout(poll, intervalMs);

        return () => {
            if (timerRef.current !== undefined) {
                clearTimeout(timerRef.current);
            }
        };
    }, [jobId]);
}
