import { useCallback, useEffect, useRef, useState, useContext } from "react";
import axios from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import type { DealFile } from "@/Types/api/file";
import {
    FileUploadError,
    FileValidationError,
} from "@/Types/uploads";
import { createFileUploadService } from "@/Services/FileUploadService";
import useTranslation from "@/Hooks/useTranslation";
import { DealWorkspaceContext } from "../context/DealWorkspaceContext";
import { DEAL_EXPOSE_MAX_UPLOAD_BYTES } from "../adapters/dealExposeAdapter";

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

function isCancelError(error: unknown): boolean {
    return (
        axios.isCancel(error) ||
        (error as { code?: string })?.code === "ERR_CANCELED"
    );
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
 * Shared deal file upload — browser streams each file to OL, then a small
 * JSON POST to `deal-files.store-external` records the DealFile rows.
 * Used by the Files tab and manual expose uploads.
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
    const generationRef = useRef(0);
    const resetTimerRef = useRef<number | null>(null);
    const serviceRef = useRef(
        createFileUploadService({
            maxFileSize: DEAL_EXPOSE_MAX_UPLOAD_BYTES,
            allowedTypes: [],
        }),
    );

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

            serviceRef.current.cancelAll();
            if (resetTimerRef.current !== null) {
                window.clearTimeout(resetTimerRef.current);
                resetTimerRef.current = null;
            }
            const generation = ++generationRef.current;

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

            const jsonHeaders = {
                Accept: "application/json",
                "X-COMPANY-ID": companyId,
                "X-CSRF-TOKEN": csrfToken(props as { csrf_token?: string }),
            };

            try {
                const olResults: Array<{
                    downloadUrl: string;
                    objectPath: string;
                    originalName: string;
                    size: number;
                }> = [];
                let completedBytes = 0;

                for (const file of rawFiles) {
                    const result = await serviceRef.current.uploadSingle(
                        file,
                        `deal-files/${dealId}`,
                        (_fileId, _pct, loaded) => {
                            if (generationRef.current !== generation) return;
                            const overall = completedBytes + loaded;
                            setUploadProgress(
                                Math.min(
                                    99,
                                    Math.round((overall / totalBytes) * 100),
                                ),
                            );
                        },
                    );

                    if (generationRef.current !== generation) {
                        return null;
                    }

                    olResults.push({
                        downloadUrl: encodeURI(result.downloadUrl),
                        objectPath: result.objectPath,
                        originalName: result.originalName,
                        size: file.size,
                    });
                    completedBytes += file.size;
                    setUploadProgress(
                        Math.min(
                            99,
                            Math.round((completedBytes / totalBytes) * 100),
                        ),
                    );
                }

                const response = await axios.post(
                    route("deal-files.store-external"),
                    {
                        deal_id: dealId,
                        files: olResults,
                    },
                    {
                        headers: jsonHeaders,
                    },
                );

                if (generationRef.current !== generation) {
                    return null;
                }

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
                            if (
                                fresh &&
                                generationRef.current === generation
                            ) {
                                workspace.setFiles(fresh);
                            }
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
                if (isCancelError(error) || generationRef.current !== generation) {
                    return null;
                }
                const isTimeout =
                    axios.isAxiosError(error) && error.code === "ECONNABORTED";
                const backendMessage = axios.isAxiosError(error)
                    ? error.response?.data?.message
                    : undefined;
                const clientMessage =
                    error instanceof FileValidationError ||
                    error instanceof FileUploadError
                        ? error.message
                        : undefined;
                message.error(
                    isTimeout
                        ? t(
                              "pages.deals.workspace.files.messages.upload_timeout",
                          )
                        : (backendMessage ??
                              clientMessage ??
                              t(
                                  "pages.deals.workspace.files.messages.upload_failed",
                              )),
                );
                return [];
            } finally {
                if (generationRef.current === generation) {
                    setIsUploading(false);
                    resetTimerRef.current = window.setTimeout(() => {
                        resetTimerRef.current = null;
                        if (generationRef.current === generation) {
                            setUploadProgress(0);
                            setUploadBytesTotal(0);
                        }
                    }, 400);
                }
            }
        },
        [dealId, props, workspace, t],
    );

    const cancelUpload = useCallback(() => {
        serviceRef.current.cancelAll();
        generationRef.current += 1;
        setIsUploading(false);
        setUploadProgress(0);
        setUploadBytesTotal(0);
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
