import { useCallback, useRef, useState } from "react";
import axios, { CancelTokenSource } from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import type { LeadContactFile } from "@/Types/api/file";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

function extractUploadedFiles(response: unknown): LeadContactFile[] {
    if (!response || typeof response !== "object") return [];
    const body = response as Record<string, unknown>;
    const data = body.data;
    if (Array.isArray(data)) return data as LeadContactFile[];
    return [];
}

export default function useLeadFileUpload(leadId: number) {
    const { td } = useTd();
    const { props } = usePage();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { setFiles } = useLeadWorkspace();
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
            formData.append("lead_id", String(leadId));
            // Always send as file[] so Laravel gives an array — matches
            // useApiMutate's FormData encoding and LeadContactFileController::store.
            rawFiles.forEach((file) => {
                formData.append("file[]", file);
            });

            try {
                const response = await axios.post(
                    route("lead-contact-files.store"),
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
                                // Total unknown (chunked) — show activity without a fake percent.
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
                    message.success(td("Files uploaded"));
                    return;
                }

                throw new Error(body?.message || "Failed to save uploaded files");
            } catch (error) {
                if (axios.isCancel(error) || (error as { code?: string })?.code === "ERR_CANCELED") {
                    return;
                }
                const backendMessage =
                    error instanceof Error
                        ? error.message
                        : (error as { message?: string; response?: { data?: { message?: string } } })
                              ?.response?.data?.message ??
                          (error as { message?: string } | undefined)?.message;
                message.error(backendMessage ?? td("Upload failed"));
            } finally {
                setIsUploading(false);
                // Keep 100 briefly visible, then clear.
                window.setTimeout(() => setUploadProgress(0), 400);
            }
        },
        [leadId, props, setFiles, td],
    );

    return {
        uploadFiles,
        isUploading,
        uploadProgress,
    };
}
