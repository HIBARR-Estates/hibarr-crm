import { useCallback, useEffect, useRef, useState, useContext } from "react";
import axios, { CancelTokenSource } from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import { DealWorkspaceContext } from "../context/DealWorkspaceContext";

export interface UploadDealFilesOptions {
    /** When false, the hook skips the Files-tab success toast (e.g. expose upload). */
    showSuccessToast?: boolean;
    /** When false, skip patching DealWorkspaceContext (rare). */
    syncWorkspace?: boolean;
}

function csrfToken(props: { csrf_token?: string }): string {
    return (
        props.csrf_token ||
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") ||
        ""
    );
}

function asDealFile(item: unknown): DealFile | null {
    if (!item || typeof item !== "object") return null;
    const id = Number((item as DealFile).id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { ...(item as DealFile), id };
}

function extractUploadedFiles(response: unknown): DealFile[] {
    if (!response || typeof response !== "object") return [];
    const body = response as Record<string, unknown>;
    const data = body.data;
    if (Array.isArray(data)) {
        return data
            .map(asDealFile)
            .filter((item): item is DealFile => item != null);
    }
    const single = asDealFile(data);
    return single ? [single] : [];
}

async function fetchDealFiles(
    dealId: number,
    companyId: string,
): Promise<DealFile[] | null> {
    const list = await axios.get(route("deals.files.index", dealId), {
        headers: {
            Accept: "application/json",
            "X-COMPANY-ID": companyId,
        },
    });
    const files = list.data?.data;
    return Array.isArray(files) ? (files as DealFile[]) : null;
}

/**
 * Shared deal file upload — multipart to `deal-files.store`, server proxies to
 * FileStorageService. Used by the Files tab and manual expose uploads.
 *
 * @returns uploaded files on success, `null` when cancelled, `[]` on failure
 */
export default function useDealFileUpload(dealId: number) {
    const { t } = useTranslation();
    const { props } = usePage();
    const workspace = useContext(DealWorkspaceContext);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadBytesTotal, setUploadBytesTotal] = useState(0);
    const cancelRef = useRef<CancelTokenSource | null>(null);
    const resetTimerRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (resetTimerRef.current !== null) {
                window.clearTimeout(resetTimerRef.current);
            }
        },
        [],
    );

    const uploadBytesLoaded =
        uploadBytesTotal > 0 && uploadProgress > 0
            ? Math.round((uploadBytesTotal * uploadProgress) / 100)
            : 0;

    const uploadFiles = useCallback(
        async (
            rawFiles: File[],
            options: UploadDealFilesOptions = {},
        ): Promise<DealFile[] | null> => {
            const {
                showSuccessToast = true,
                syncWorkspace = true,
            } = options;

            if (rawFiles.length === 0 || dealId <= 0) {
                return [];
            }

            cancelRef.current?.cancel("replaced");
            // A previous upload's delayed reset (below) could still be
            // pending — let it fire and it would zero out this new upload's
            // progress/bytes mid-flight.
            if (resetTimerRef.current !== null) {
                window.clearTimeout(resetTimerRef.current);
                resetTimerRef.current = null;
            }
            const cancelSource = axios.CancelToken.source();
            cancelRef.current = cancelSource;

            const totalBytes = rawFiles.reduce(
                (sum, file) => sum + file.size,
                0,
            );

            setIsUploading(true);
            setUploadProgress(0);
            setUploadBytesTotal(totalBytes);

            const companyId =
                props.auth?.user?.company_id != null
                    ? String(props.auth.user.company_id)
                    : "";

            const formData = new FormData();
            formData.append("lead_id", String(dealId));
            rawFiles.forEach((file) => {
                formData.append("file[]", file);
            });

            try {
                const response = await axios.post(
                    route("deal-files.store"),
                    formData,
                    {
                        cancelToken: cancelSource.token,
                        // Large files proxy through Laravel to the external storage
                        // API (uploaded twice, up to 3 attempts x 300s each server-side);
                        // give that legroom instead of hanging the UI indefinitely if
                        // the server never responds.
                        timeout: 1200000,
                        headers: {
                            Accept: "application/json",
                            "X-COMPANY-ID": companyId,
                            "X-CSRF-TOKEN": csrfToken(
                                props as { csrf_token?: string },
                            ),
                        },
                        onUploadProgress: (event) => {
                            if (event.total && event.total > 0) {
                                const pct = Math.min(
                                    99,
                                    Math.round(
                                        (event.loaded / event.total) * 100,
                                    ),
                                );
                                setUploadProgress(pct);
                            } else if (event.loaded > 0) {
                                setUploadProgress((prev) =>
                                    prev < 15 ? 15 : Math.min(prev + 5, 90),
                                );
                            }
                        },
                    },
                );

                const body = response.data;
                if (body?.status === "success") {
                    const uploaded = extractUploadedFiles(body);

                    if (syncWorkspace && workspace) {
                        if (uploaded.length > 0) {
                            workspace.setFiles((prev) => {
                                const ids = new Set(
                                    uploaded.map((file) => file.id),
                                );
                                return [
                                    ...uploaded,
                                    ...prev.filter((file) => !ids.has(file.id)),
                                ];
                            });
                        }

                        try {
                            const fresh = await fetchDealFiles(
                                dealId,
                                companyId,
                            );
                            if (fresh) workspace.setFiles(fresh);
                        } catch {
                            // Keep optimistic merge if refetch fails.
                        }
                    }

                    setUploadProgress(100);
                    if (showSuccessToast) {
                        message.success(
                            t(
                                "pages.deals.workspace.files.messages.uploaded",
                            ),
                        );
                    }
                    return uploaded;
                }

                throw new Error(
                    body?.message ||
                        t(
                            "pages.deals.workspace.files.messages.save_failed",
                        ),
                );
            } catch (error) {
                if (
                    axios.isCancel(error) ||
                    (error as { code?: string })?.code === "ERR_CANCELED"
                ) {
                    return null;
                }
                const isTimeout =
                    axios.isAxiosError(error) && error.code === "ECONNABORTED";
                const backendMessage = axios.isAxiosError(error)
                    ? error.response?.data?.message
                    : undefined;
                message.error(
                    isTimeout
                        ? t(
                              "pages.deals.workspace.files.messages.upload_timeout",
                          )
                        : (backendMessage ??
                              t(
                                  "pages.deals.workspace.files.messages.upload_failed",
                              )),
                );
                return [];
            } finally {
                // A newer upload may already be mid-flight (it cancelled this
                // one via cancelRef.current?.cancel() above) — only clear the
                // uploading flag if this call is still the active one, or a
                // cancelled call's delayed finally would flip it back to
                // false while the replacement is genuinely still uploading.
                if (cancelRef.current === cancelSource) {
                    setIsUploading(false);
                }
                resetTimerRef.current = window.setTimeout(() => {
                    resetTimerRef.current = null;
                    // A newer upload may have started (and be mid-flight)
                    // before this fires — only this call's own cancelSource
                    // still being the active one means it's safe to reset.
                    if (cancelRef.current === cancelSource) {
                        setUploadProgress(0);
                        setUploadBytesTotal(0);
                    }
                }, 400);
            }
        },
        [dealId, props, workspace, t],
    );

    const cancelUpload = useCallback(() => {
        cancelRef.current?.cancel("cancelled");
        setIsUploading(false);
        setUploadProgress(0);
        setUploadBytesTotal(0);
        cancelRef.current = null;
    }, []);

    return {
        uploadFiles,
        cancelUpload,
        isUploading,
        uploadProgress,
        uploadBytesLoaded,
        uploadBytesTotal,
    };
}
