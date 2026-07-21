import { useCallback, useRef, useState } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { getFileUploadService } from "@/Services/FileUploadService";
import { IUploadResponseItem } from "@/Types/uploads";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

interface StoreExternalPayload {
    deal_id: number;
    files: IUploadResponseItem[];
}

export default function useDealFileUpload(dealId: number) {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { setFiles } = useDealWorkspace();
    const uploadServiceRef = useRef(
        getFileUploadService({
            maxFileSize: 200 * 1024 * 1024,
            allowedTypes: [],
        }),
    );

    const saveMutation = useApiMutate<
        StoreExternalPayload,
        DealFile[],
        ApiResponse<DealFile[]>
    >(route("deal-files.store-external"), "POST");

    const uploadFiles = useCallback(
        async (rawFiles: File[]) => {
            if (rawFiles.length === 0) return;

            setIsUploading(true);
            setUploadProgress(0);

            try {
                const uploadService = uploadServiceRef.current;
                const results: IUploadResponseItem[] = [];

                for (let index = 0; index < rawFiles.length; index += 1) {
                    const file = rawFiles[index];
                    const result = await uploadService.uploadSingle(
                        file,
                        "deal-files",
                        (_fileId, progress) => {
                            const fileProgress = progress / rawFiles.length;
                            const baseProgress = (index / rawFiles.length) * 100;
                            setUploadProgress(
                                Math.round(baseProgress + fileProgress),
                            );
                        },
                    );
                    results.push(result);
                    setUploadProgress(
                        Math.round(((index + 1) / rawFiles.length) * 100),
                    );
                }

                await new Promise<void>((resolve, reject) => {
                    saveMutation.mutate(
                        {
                            deal_id: dealId,
                            files: results.map((result) => ({
                                downloadUrl: encodeURI(result.downloadUrl),
                                objectPath: result.objectPath,
                                originalName: result.originalName,
                                size: 0,
                            })),
                        } as StoreExternalPayload,
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
                const messageText =
                    error instanceof Error
                        ? error.message
                        : t("pages.deals.workspace.files.messages.upload_failed");
                message.error(messageText);
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
