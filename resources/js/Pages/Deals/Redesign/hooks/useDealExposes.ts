import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TdFn } from "@/lib/dynamicTranslation";
import type {
    DealExpose,
    DealExposeLinkableEntity,
    DealExposeStatus,
    DealExposeSummary,
    DealExposesResponse,
} from "@/Types/api/dealExposes";
import {
    DEAL_EXPOSE_MAX_UPLOAD_BYTES,
    dealFileToExposeStoreBody,
} from "../adapters/dealExposeAdapter";
import useDealFileUpload from "./useDealFileUpload";

const EMPTY_SUMMARY: DealExposeSummary = {
    total: 0,
    not_sent: 0,
    shown: 0,
    accepted: 0,
    not_accepted: 0,
};

/**
 * Rows already fetched for a given index URL, kept for the lifetime of the
 * browser tab. The Exposes tab unmounts whenever another workspace tab is
 * selected, so without this every re-selection would drop back to the
 * skeleton. First open in a page session still shows the skeleton; after
 * that the cached list renders immediately and is reconciled in the
 * background. Keyed by index URL, so each deal/lead caches separately.
 */
const exposeListCache = new Map<string, DealExpose[]>();

/** CRM JSON responses use Reply::{success,error} with HTTP 200 for both. */
function extractExposeFromStoreResponse(body: unknown): DealExpose | null {
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    if (record.status !== "success") return null;
    const expose = record.expose;
    if (!expose || typeof expose !== "object") return null;
    const id = Number((expose as DealExpose).id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return expose as DealExpose;
}

function resolveAddExposeErrorMessage(
    error: unknown,
    t: (key: string) => string,
    td: TdFn,
): string {
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

        if (error.response?.status === 413) {
            return td(
                "This file is too large for the CRM web server limit (nginx/PHP post_max_size). Increase upload limits or use a smaller file.",
                { source: "en" },
            );
        }

        if (
            error.response?.status === 401 ||
            error.response?.status === 403
        ) {
            return td(
                "You do not have permission to add exposes on this deal.",
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
    entityType?: DealExposeLinkableEntity["entity_type"] | null;
    entityId?: number | null;
    unitTypeId?: number | null;
    file?: File | null;
}

type Scope =
    | { type: "deal"; dealId: number }
    | { type: "lead"; leadId: number };

export interface DealExposeEntityQuery {
    scope: DealExposeLinkableEntity["entity_type"];
    /** Required when scope is "unit_type" — which project's units to list. */
    projectId?: number | null;
    search: string;
}

interface AvailableEntitiesPage {
    entities?: DealExposeLinkableEntity[];
    current_page?: number;
    last_page?: number;
}

/**
 * Paginated, server-searched fetch of one page of properties / developer
 * projects / unit types (within one project) for the linked-add picker.
 * Re-fetches page 1 whenever the scope/project/search changes; `loadMore`
 * appends the next page. Fetched only while the linked dialog is open, with
 * cancellation on close/unmount. Picking one and submitting mints a
 * personalized exposé link (see DealExposeController::store()).
 */
export function useDealExposeEntities(
    dealId: number,
    query: DealExposeEntityQuery,
    enabled: boolean,
) {
    const [entities, setEntities] = useState<DealExposeLinkableEntity[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const reload = useCallback(() => setRefreshKey((key) => key + 1), []);

    const queryKey = `${query.scope}:${query.projectId ?? ""}:${query.search}`;
    // Read inside loadMore's async callback so a "load more" started before a
    // scope/project/search change discards its response instead of appending
    // stale-scope rows onto the freshly-reset list (and duplicate React keys)
    // once it resolves after the switch.
    const queryKeyRef = useRef(queryKey);
    useEffect(() => {
        queryKeyRef.current = queryKey;
    }, [queryKey]);

    useEffect(() => {
        if (!enabled) {
            setEntities([]);
            setPage(1);
            setLastPage(1);
            setLoading(false);
            setLoadingMore(false);
            setLoadFailed(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        // A "load more" in flight for the previous scope/project/search will
        // discard its own response (queryKeyRef guard below), but its
        // `finally` won't run until that request settles — clear the flag
        // now so the button isn't stuck disabled for the new query.
        setLoadingMore(false);
        setLoadFailed(false);

        axios
            .get<AvailableEntitiesPage>(route("deals.exposes.available", dealId), {
                headers: { Accept: "application/json" },
                params: {
                    scope: query.scope,
                    project_id: query.projectId ?? undefined,
                    search: query.search.trim() || undefined,
                    page: 1,
                },
            })
            .then(({ data }) => {
                if (cancelled) return;
                setEntities(Array.isArray(data?.entities) ? data.entities : []);
                setPage(data?.current_page ?? 1);
                setLastPage(data?.last_page ?? 1);
            })
            .catch(() => {
                if (!cancelled) {
                    setEntities([]);
                    setPage(1);
                    setLastPage(1);
                    setLoadFailed(true);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dealId, enabled, queryKey, refreshKey]);

    const loadMore = useCallback(async () => {
        if (loadingMore || page >= lastPage) return;

        const requestKey = queryKey;
        setLoadingMore(true);
        try {
            const { data } = await axios.get<AvailableEntitiesPage>(
                route("deals.exposes.available", dealId),
                {
                    headers: { Accept: "application/json" },
                    params: {
                        scope: query.scope,
                        project_id: query.projectId ?? undefined,
                        search: query.search.trim() || undefined,
                        page: page + 1,
                    },
                },
            );
            if (queryKeyRef.current !== requestKey) return;
            setEntities((current) => [
                ...current,
                ...(Array.isArray(data?.entities) ? data.entities : []),
            ]);
            setPage(data?.current_page ?? page + 1);
            setLastPage(data?.last_page ?? lastPage);
        } catch {
            // Leave the existing page in place — the Load more button stays
            // visible so the user can retry.
        } finally {
            if (queryKeyRef.current === requestKey) setLoadingMore(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dealId, queryKey, query.scope, query.projectId, query.search, page, lastPage, loadingMore]);

    return {
        entities,
        loading,
        loadingMore,
        loadFailed,
        hasMore: page < lastPage,
        loadMore,
        reload,
    };
}

/**
 * Owns the Exposes tab's list and every mutation on it. Status changes and
 * additions patch this hook's local state from the response rather than
 * reloading the page, so edits land instantly (CLAUDE.md rule 3).
 *
 * Manual documents reuse {@link useDealFileUpload} (same as the Files tab),
 * then register an expose row pointing at the uploaded deal file.
 */
export default function useDealExposes(scope: Scope) {
    const { t } = useTranslation();
    const { td } = useTd();
    const dealId = scope.type === "deal" ? scope.dealId : 0;
    const {
        uploadFiles,
        cancelUpload: cancelDealFileUpload,
        isUploading: isUploadingFile,
        uploadProgress,
        uploadBytesLoaded,
        uploadBytesTotal,
    } = useDealFileUpload(dealId);
    const indexUrl =
        scope.type === "deal"
            ? route("deals.exposes.index", scope.dealId)
            : route("leads.exposes.index", scope.leadId);

    const cached = exposeListCache.get(indexUrl);
    const [exposes, setExposes] = useState<DealExpose[]>(cached ?? []);
    const [loading, setLoading] = useState(cached === undefined);
    const [saving, setSaving] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const statusRequestRef = useRef<Map<number, number>>(new Map());
    /** Which index URL this instance has already kicked a fetch off for. */
    const loadedUrlRef = useRef<string | null>(null);

    const fetchExposes = useCallback(async (): Promise<DealExpose[] | null> => {
        try {
            const { data } = await axios.get<DealExposesResponse>(indexUrl, {
                headers: { Accept: "application/json" },
            });
            return Array.isArray(data?.exposes) ? data.exposes : [];
        } catch {
            return null;
        }
    }, [indexUrl]);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            const rows = await fetchExposes();
            if (rows === null) {
                setLoadFailed(true);
                setExposes([]);
                return;
            }
            setExposes(rows);
        } finally {
            setLoading(false);
        }
    }, [fetchExposes]);

    /** Reconcile from index without toggling the panel skeleton. */
    const reconcileExposes = useCallback(async () => {
        const rows = await fetchExposes();
        if (rows !== null) {
            setExposes(rows);
        }
    }, [fetchExposes]);

    const registerExpose = useCallback(
        async (body: Record<string, unknown>): Promise<DealExpose> => {
            if (scope.type !== "deal") {
                throw new Error(
                    t("pages.deals.workspace.exposes.messages.add_failed"),
                );
            }

            const response = await axios.post(
                route("deals.exposes.store", scope.dealId),
                body,
                { headers: { Accept: "application/json" } },
            );

            const expose = extractExposeFromStoreResponse(response.data);
            if (expose) {
                return expose;
            }

            const apiMessage =
                typeof response.data?.message === "string"
                    ? response.data.message
                    : t("pages.deals.workspace.exposes.messages.add_failed");
            throw new Error(apiMessage);
        },
        [scope, t],
    );

    const commitAddedExpose = useCallback(
        async (expose: DealExpose) => {
            setExposes((current) => [
                expose,
                ...current.filter((row) => row.id !== expose.id),
            ]);

            // Match Files tab: always reconcile so the list matches the server
            // even if a race or odd payload skipped the optimistic row.
            await reconcileExposes();
        },
        [reconcileExposes],
    );

    // Only publish to the cache once a fetch has actually succeeded — seeding
    // it with the pre-fetch empty list would make the next mount skip the
    // skeleton and render "no exposés" while the first request is still out.
    useEffect(() => {
        if (loading || loadFailed) return;
        exposeListCache.set(indexUrl, exposes);
    }, [indexUrl, exposes, loading, loadFailed]);

    useEffect(() => {
        if (loadedUrlRef.current === indexUrl) return;
        loadedUrlRef.current = indexUrl;
        // Rows from an earlier visit to this tab: refresh them silently
        // instead of flashing the skeleton again.
        void (exposeListCache.has(indexUrl) ? reconcileExposes() : load());
    }, [indexUrl, load, reconcileExposes]);

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
                const response = await axios.patch(
                    route("deal-exposes.status", id),
                    { status },
                    { headers: { Accept: "application/json" } },
                );
                const updated = extractExposeFromStoreResponse(response.data);
                if (statusRequestRef.current.get(id) !== requestId) return;
                if (!updated) {
                    throw new Error(
                        typeof response.data?.message === "string"
                            ? response.data.message
                            : undefined,
                    );
                }
                setExposes((current) =>
                    current.map((expose) =>
                        expose.id === id ? updated : expose,
                    ),
                );
            } catch (error) {
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
                    (error instanceof Error && error.message) ||
                        t("pages.deals.workspace.exposes.messages.status_failed"),
                );
            }
        },
        [t],
    );

    const addExpose = useCallback(
        async (input: AddExposeInput): Promise<string | null> => {
            if (scope.type !== "deal") {
                return t("pages.deals.workspace.exposes.messages.add_failed");
            }

            setSaving(true);

            try {
                if (input.file) {
                    if (input.file.size > DEAL_EXPOSE_MAX_UPLOAD_BYTES) {
                        const msg = td(
                            "This file exceeds the 1 GB maximum size.",
                            { source: "en" },
                        );
                        message.error(msg);
                        return msg;
                    }

                    const uploaded = await uploadFiles([input.file], {
                        showSuccessToast: false,
                    });

                    if (uploaded === null) {
                        return td("Upload cancelled.", { source: "en" });
                    }
                    if (uploaded.length === 0) {
                        return t(
                            "pages.deals.workspace.exposes.messages.add_failed",
                        );
                    }

                    const expose = await registerExpose({
                        source: input.source,
                        title: input.title,
                        source_label: input.sourceLabel ?? null,
                        amount: input.amount ?? null,
                        entity_type: input.entityType ?? null,
                        entity_id: input.entityId ?? null,
                        unit_type_id: input.unitTypeId ?? null,
                        ...dealFileToExposeStoreBody(uploaded[0]),
                    });

                    await commitAddedExpose(expose);
                    message.success(
                        t("pages.deals.workspace.exposes.messages.added"),
                    );
                    return null;
                }

                const expose = await registerExpose({
                    source: input.source,
                    title: input.title,
                    source_label: input.sourceLabel ?? null,
                    amount: input.amount ?? null,
                    entity_type: input.entityType ?? null,
                    entity_id: input.entityId ?? null,
                    unit_type_id: input.unitTypeId ?? null,
                });

                await commitAddedExpose(expose);
                message.success(
                    t("pages.deals.workspace.exposes.messages.added"),
                );
                return null;
            } catch (error) {
                if (axios.isCancel(error)) {
                    return td("Upload cancelled.", { source: "en" });
                }
                const msg = resolveAddExposeErrorMessage(error, t, td);
                message.error(msg);
                return msg;
            } finally {
                setSaving(false);
            }
        },
        [scope, t, td, uploadFiles, registerExpose, commitAddedExpose],
    );

    const cancelUpload = useCallback(() => {
        cancelDealFileUpload();
        setSaving(false);
    }, [cancelDealFileUpload]);

    const updateExpose = useCallback(
        async (
            id: number,
            patch: { title?: string; amount?: number | null },
        ) => {
            // The lead rollup lists exposes across several deals — one of
            // them may be locked while the others aren't, so this can't be a
            // single canEdit boolean; check the specific row instead. The
            // server rejects this too (defense in depth), but failing fast
            // here skips a pointless optimistic-update-then-revert flicker.
            if (exposes.find((expose) => expose.id === id)?.deal_is_locked) {
                throw new Error(
                    t("pages.deals.workspace.exposes.messages.deal_locked"),
                );
            }

            let previous: DealExpose | null = null;
            setExposes((current) =>
                current.map((expose) => {
                    if (expose.id !== id) return expose;
                    previous = expose;
                    return {
                        ...expose,
                        ...(patch.title !== undefined
                            ? { title: patch.title }
                            : {}),
                        ...(patch.amount !== undefined
                            ? { amount: patch.amount }
                            : {}),
                    };
                }),
            );

            try {
                const response = await axios.patch(
                    route("deal-exposes.update", id),
                    patch,
                    { headers: { Accept: "application/json" } },
                );
                const updated = extractExposeFromStoreResponse(response.data);
                if (!updated) {
                    throw new Error(
                        typeof response.data?.message === "string"
                            ? response.data.message
                            : t(
                                  "pages.deals.workspace.exposes.messages.update_failed",
                              ),
                    );
                }
                setExposes((current) =>
                    current.map((expose) =>
                        expose.id === id ? updated : expose,
                    ),
                );
            } catch (error) {
                if (previous) {
                    setExposes((current) =>
                        current.map((expose) =>
                            expose.id === id ? previous! : expose,
                        ),
                    );
                }
                if (error instanceof Error && error.message) {
                    throw error;
                }
                const apiMessage = axios.isAxiosError(error)
                    ? error.response?.data?.message
                    : undefined;
                throw new Error(
                    typeof apiMessage === "string" && apiMessage !== ""
                        ? apiMessage
                        : t(
                              "pages.deals.workspace.exposes.messages.update_failed",
                          ),
                );
            }
        },
        [t, exposes],
    );

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
        updateExpose,
        addExpose,
        removeExpose,
        cancelUpload,
    };
}
