import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TdFn } from "@/lib/dynamicTranslation";
import { getFileUploadService } from "@/Services/FileUploadService";
import { FileValidationError } from "@/Types/uploads";
import type {
    DealExpose,
    DealExposeSnapshotOption,
    DealExposeStatus,
    DealExposeSummary,
    DealExposesResponse,
} from "@/Types/api/dealExposes";
import { DEAL_EXPOSE_MAX_UPLOAD_BYTES } from "../adapters/dealExposeAdapter";

const EMPTY_SUMMARY: DealExposeSummary = {
    total: 0,
    not_sent: 0,
    shown: 0,
    accepted: 0,
    not_accepted: 0,
};

function resolveAddExposeErrorMessage(
    error: unknown,
    t: (key: string) => string,
    td: TdFn,
): string {
    if (error instanceof FileValidationError) {
        return error.message;
    }

    if (axios.isCancel(error)) {
        return td("Upload cancelled.", { source: "en" });
    }

    if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
            return td(
                "Upload timed out. Large files need a stable connection — try again or use a smaller file.",
                { source: "en" },
            );
        }

        if (
            error.response?.status === 401 ||
            error.response?.status === 403
        ) {
            return td(
                "Upload authentication failed. Check MIX_FILE_UPLOAD_API_KEY in .env and restart the Vite dev server.",
                { source: "en" },
            );
        }

        if (error.code === "ERR_NETWORK") {
            return td(
                "Upload could not reach the storage API. Check the browser console for CORS or network errors.",
                { source: "en" },
            );
        }

        const apiMessage = error.response?.data?.message;
        if (typeof apiMessage === "string" && apiMessage !== "") {
            return apiMessage;
        }

        if (error.message) {
            return error.message;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return t("pages.deals.workspace.exposes.messages.add_failed");
}

export interface AddExposeInput {
    source: "linked" | "manual";
    title: string;
    sourceLabel?: string;
    amount?: number | null;
    exposeSnapshotId?: number | null;
    file?: File | null;
}

type Scope =
    | { type: "deal"; dealId: number }
    | { type: "lead"; leadId: number };

/**
 * Lazy-loads project expose snapshots for the linked-add modal. Fetched only
 * while the linked dialog is open, with cancellation on close/unmount.
 */
export function useDealExposeSnapshots(dealId: number, enabled: boolean) {
    const [snapshots, setSnapshots] = useState<DealExposeSnapshotOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setSnapshots([]);
            setLoading(false);
            setLoadFailed(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setLoadFailed(false);

        axios
            .get<{ snapshots: DealExposeSnapshotOption[] }>(
                route("deals.exposes.available", dealId),
                { headers: { Accept: "application/json" } },
            )
            .then(({ data }) => {
                if (!cancelled) setSnapshots(data.snapshots ?? []);
            })
            .catch(() => {
                if (!cancelled) {
                    setSnapshots([]);
                    setLoadFailed(true);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [dealId, enabled]);

    return { snapshots, loading, loadFailed };
}

/**
 * Owns the Exposes tab's list and every mutation on it. Status changes and
 * additions patch this hook's local state from the response rather than
 * reloading the page, so edits land instantly (CLAUDE.md rule 3).
 *
 * The list is fetched here rather than deferred through Inertia because the
 * tab is reachable from two different pages (Deal and Lead) and only matters
 * once its tab is opened.
 */
export default function useDealExposes(scope: Scope) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [exposes, setExposes] = useState<DealExpose[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadBytesLoaded, setUploadBytesLoaded] = useState(0);
    const [uploadBytesTotal, setUploadBytesTotal] = useState(0);
    const [loadFailed, setLoadFailed] = useState(false);
    const statusRequestRef = useRef<Map<number, number>>(new Map());

    const indexUrl =
        scope.type === "deal"
            ? route("deals.exposes.index", scope.dealId)
            : route("leads.exposes.index", scope.leadId);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            const { data } = await axios.get<DealExposesResponse>(indexUrl, {
                headers: { Accept: "application/json" },
            });
            setExposes(data.exposes ?? []);
        } catch {
            setLoadFailed(true);
            setExposes([]);
        } finally {
            setLoading(false);
        }
    }, [indexUrl]);

    useEffect(() => {
        void load();
    }, [load]);

    /**
     * Recomputed locally rather than reused from the response so the counters
     * stay in step with an optimistic status change.
     */
    const summary = useMemo<DealExposeSummary>(() => {
        const count = (status: DealExposeStatus) =>
            exposes.filter((expose) => expose.status === status).length;

        return {
            total: exposes.length,
            not_sent: count("not_sent"),
            shown: count("shown"),
            accepted: count("accepted"),
            not_accepted: count("not_accepted"),
        };
    }, [exposes]);

    const setStatus = useCallback(
        async (id: number, status: DealExposeStatus) => {
            const requestId = (statusRequestRef.current.get(id) ?? 0) + 1;
            statusRequestRef.current.set(id, requestId);

            let previousStatus: DealExposeStatus | null = null;
            setExposes((current) =>
                current.map((expose) => {
                    if (expose.id !== id) return expose;
                    previousStatus = expose.status;
                    return { ...expose, status };
                }),
            );

            try {
                const { data } = await axios.patch<{ expose: DealExpose }>(
                    route("deal-exposes.status", id),
                    { status },
                    { headers: { Accept: "application/json" } },
                );
                if (statusRequestRef.current.get(id) !== requestId) return;
                setExposes((current) =>
                    current.map((expose) =>
                        expose.id === id ? data.expose : expose,
                    ),
                );
            } catch {
                if (statusRequestRef.current.get(id) !== requestId) return;
                if (previousStatus !== null) {
                    setExposes((current) =>
                        current.map((expose) =>
                            expose.id === id
                                ? { ...expose, status: previousStatus! }
                                : expose,
                        ),
                    );
                }
                message.error(
                    t("pages.deals.workspace.exposes.messages.status_failed"),
                );
            }
        },
        [t],
    );

    const addExpose = useCallback(
        async (input: AddExposeInput): Promise<boolean> => {
            if (scope.type !== "deal") return false;

            setSaving(true);
            setUploadProgress(0);
            setUploadBytesLoaded(0);
            setUploadBytesTotal(input.file?.size ?? 0);
            setIsUploadingFile(false);
            try {
                const body: Record<string, unknown> = {
                    source: input.source,
                    title: input.title,
                    source_label: input.sourceLabel ?? null,
                    amount: input.amount ?? null,
                    expose_snapshot_id: input.exposeSnapshotId ?? null,
                };

                if (input.file) {
                    setIsUploadingFile(true);
                    setUploadBytesTotal(input.file.size);
                    const uploadService = getFileUploadService({
                        maxFileSize: DEAL_EXPOSE_MAX_UPLOAD_BYTES,
                        allowedTypes: [],
                    });
                    const uploaded = await uploadService.uploadSingle(
                        input.file,
                        `deal-exposes/${scope.dealId}`,
                        (_fileId, progress, loadedBytes) => {
                            setUploadProgress(progress);
                            if (loadedBytes != null) {
                                setUploadBytesLoaded(loadedBytes);
                            }
                        },
                    );
                    setIsUploadingFile(false);
                    setUploadProgress(100);
                    body.download_url = uploaded.downloadUrl;
                    body.object_path = uploaded.objectPath;
                    body.uploaded_filename = input.file.name;
                    body.uploaded_size = input.file.size;
                }

                const { data } = await axios.post<{ expose: DealExpose }>(
                    route("deals.exposes.store", scope.dealId),
                    body,
                    { headers: { Accept: "application/json" } },
                );

                setExposes((current) => [data.expose, ...current]);
                message.success(
                    t("pages.deals.workspace.exposes.messages.added"),
                );
                return true;
            } catch (error) {
                message.error(resolveAddExposeErrorMessage(error, t, td));
                return false;
            } finally {
                setSaving(false);
                setIsUploadingFile(false);
                setUploadBytesLoaded(0);
                setUploadBytesTotal(0);
                window.setTimeout(() => setUploadProgress(0), 400);
            }
        },
        [scope, t, td],
    );

    const cancelUpload = useCallback(() => {
        getFileUploadService().cancelAll();
        setSaving(false);
        setIsUploadingFile(false);
        setUploadProgress(0);
        setUploadBytesLoaded(0);
        setUploadBytesTotal(0);
    }, []);

    const removeExpose = useCallback(
        async (id: number) => {
            const previous = exposes;
            setExposes((current) =>
                current.filter((expose) => expose.id !== id),
            );

            try {
                await axios.delete(route("deal-exposes.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                message.success(
                    t("pages.deals.workspace.exposes.messages.removed"),
                );
            } catch {
                setExposes(previous);
                message.error(
                    t("pages.deals.workspace.exposes.messages.remove_failed"),
                );
            }
        },
        [exposes, t],
    );

    return {
        exposes,
        summary: exposes.length === 0 ? EMPTY_SUMMARY : summary,
        loading,
        saving,
        isUploadingFile,
        uploadProgress,
        uploadBytesLoaded,
        uploadBytesTotal,
        loadFailed,
        reload: load,
        setStatus,
        addExpose,
        removeExpose,
        cancelUpload,
    };
}
