import { useCallback, useRef, useState } from "react";
import axios, { CancelTokenSource } from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

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

export default function useDealFileUpload(dealId: number) {
    const { t } = useTranslation();
    const { props } = usePage();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { setFiles } = useDealWorkspace();
    // axios@0.21 only supports CancelToken (not AbortSignal).
    const cancelRef = useRef<CancelTokenSource | null>(null);

    const uploadFiles = useCallback(
        async (rawFiles: File[]) => {
            if (rawFiles.length === 0) return;

            cancelRef.current?.cancel("replaced");
            const cancelSource = axios.CancelToken.source();
            cancelRef.current = cancelSource;

            setIsUploading(true);
            setUploadProgress(0);

            const companyId =
                props.auth?.user?.company_id != null
                    ? String(props.auth.user.company_id)
                    : "";

            const formData = new FormData();
            formData.append("lead_id", String(dealId));
            // Always send as file[] so Laravel gives an array — matches
            // useApiMutate's FormData encoding and LeadFileController::store.
            rawFiles.forEach((file) => {
                formData.append("file[]", file);
            });

            try {
                const response = await axios.post(
                    route("deal-files.store"),
                    formData,
                    {
                        cancelToken: cancelSource.token,
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
                    if (uploaded.length > 0) {
                        setFiles((prev) => {
                            const ids = new Set(
                                uploaded.map((file) => file.id),
                            );
                            return [
                                ...uploaded,
                                ...prev.filter((file) => !ids.has(file.id)),
                            ];
                        });
                    }

                    // Always reconcile from the index endpoint so the Files
                    // tab matches the server even if the store payload shape
                    // is odd or the first seed race wiped local state.
                    try {
                        const fresh = await fetchDealFiles(dealId, companyId);
                        if (fresh) setFiles(fresh);
                    } catch {
                        // Keep optimistic merge from `uploaded` if refetch fails.
                    }

                    setUploadProgress(100);
                    message.success(
                        t("pages.deals.workspace.files.messages.uploaded"),
                    );
                    return;
                }

                throw new Error(
                    body?.message || t("pages.deals.workspace.files.messages.save_failed"),
                );
            } catch (error) {
                if (
                    axios.isCancel(error) ||
                    (error as { code?: string })?.code === "ERR_CANCELED"
                ) {
                    return;
                }
                const backendMessage =
                    error instanceof Error
                        ? error.message
                        : (error as {
                              response?: { data?: { message?: string } };
                              message?: string;
                          })?.response?.data?.message ??
                          (error as { message?: string } | undefined)?.message;
                message.error(
                    backendMessage ??
                        t("pages.deals.workspace.files.messages.upload_failed"),
                );
            } finally {
                setIsUploading(false);
                window.setTimeout(() => setUploadProgress(0), 400);
            }
        },
        [dealId, props, setFiles, t],
    );

    return {
        uploadFiles,
        isUploading,
        uploadProgress,
    };
}
