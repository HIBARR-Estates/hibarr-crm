import { useCallback, useState } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

interface StorePayload {
    lead_id: number;
    file: File[];
}

export default function useDealFileUpload(dealId: number) {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { setFiles } = useDealWorkspace();

    // Uploads go through Laravel (LeadFileController::store), which proxies to
    // external storage server-side via FileStorageService — the browser never
    // sees the storage API key, unlike the old direct-to-external-API path.
    const saveMutation = useApiMutate<
        StorePayload,
        DealFile[],
        ApiResponse<DealFile[]>
    >(route("deal-files.store"), "POST", undefined, true);

    const uploadFiles = useCallback(
        async (rawFiles: File[]) => {
            if (rawFiles.length === 0) return;

            setIsUploading(true);
            setUploadProgress(0);

            try {
                await new Promise<void>((resolve, reject) => {
                    saveMutation.mutate(
                        {
                            lead_id: dealId,
                            file: rawFiles,
                        } as StorePayload,
                        {
                            onSuccess: (response) => {
                                if (response?.status === "success") {
                                    message.success(
                                        t("pages.deals.workspace.files.messages.uploaded"),
                                    );
                                    if (response.data) {
                                        const uploaded = response.data;
                                        setFiles((prev) => [...uploaded, ...prev]);
                                    }
                                    setUploadProgress(100);
                                    resolve();
                                    return;
                                }

                                reject(new Error("Failed to save uploaded files"));
                            },
                            onError: (error) => reject(error),
                        },
                    );
                });
            } catch (error) {
                // useApiMutate throws the raw backend error payload (not an Error
                // instance) — in dev (app.debug=true) it carries the real message.
                const backendMessage =
                    error instanceof Error
                        ? error.message
                        : (error as { message?: string } | undefined)?.message;
                message.error(
                    backendMessage ??
                        t("pages.deals.workspace.files.messages.upload_failed"),
                );
            } finally {
                setIsUploading(false);
                setUploadProgress(0);
            }
        },
        [dealId, saveMutation, t],
    );

    return {
        uploadFiles,
        isUploading: isUploading || saveMutation.isPending,
        uploadProgress,
    };
}
