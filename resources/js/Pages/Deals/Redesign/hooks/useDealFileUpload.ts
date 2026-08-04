import { useCallback, useRef, useState } from "react";
import axios, { CancelTokenSource } from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

function extractUploadedFiles(response: unknown): DealFile[] {
    if (!response || typeof response !== "object") return [];
    const body = response as Record<string, unknown>;
    const data = body.data;
    if (Array.isArray(data)) return data as DealFile[];
    return [];
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

            const formData = new FormData();
            formData.append("lead_id", String(dealId));
            if (rawFiles.length === 1) {
                formData.append("file", rawFiles[0]);
            } else {
                rawFiles.forEach((file, index) => {
                    formData.append(`file[${index}]`, file);
                });
            }

            try {
                const response = await axios.post(
                    route("deal-files.store"),
                    formData,
                    {
                        cancelToken: cancelSource.token,
                        headers: {
                            Accept: "application/json",
                            "X-COMPANY-ID":
                                props.auth?.user?.company_id != null
                                    ? String(props.auth.user.company_id)
                                    : "",
                            "X-CSRF-TOKEN":
                                (props as { csrf_token?: string }).csrf_token ??
                                "",
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
                        setFiles((prev) => [...uploaded, ...prev]);
                    }
                    setUploadProgress(100);
                    message.success(
                        t("pages.deals.workspace.files.messages.uploaded"),
                    );
                    return;
                }

                throw new Error(body?.message || "Failed to save uploaded files");
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
