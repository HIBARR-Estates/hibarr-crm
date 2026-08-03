import { useCallback, useState } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import type { LeadContactFile } from "@/Types/api/file";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

interface StorePayload {
    lead_id: number;
    file: File[];
}

export default function useLeadFileUpload(leadId: number) {
    const { td } = useTd();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { setFiles } = useLeadWorkspace();

    const saveMutation = useApiMutate<
        StorePayload,
        LeadContactFile[],
        ApiResponse<LeadContactFile[]>
    >(route("lead-contact-files.store"), "POST", undefined, true);

    const uploadFiles = useCallback(
        async (rawFiles: File[]) => {
            if (rawFiles.length === 0) return;

            setIsUploading(true);
            setUploadProgress(0);

            try {
                await new Promise<void>((resolve, reject) => {
                    saveMutation.mutate(
                        {
                            lead_id: leadId,
                            file: rawFiles,
                        } as StorePayload,
                        {
                            onSuccess: (response) => {
                                if (response?.status === "success") {
                                    message.success(td("Files uploaded"));
                                    if (response.data) {
                                        setFiles((prev) => [
                                            ...response.data!,
                                            ...prev,
                                        ]);
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
                const backendMessage =
                    error instanceof Error
                        ? error.message
                        : (error as { message?: string } | undefined)?.message;
                message.error(backendMessage ?? td("Upload failed"));
            } finally {
                setIsUploading(false);
                setUploadProgress(0);
            }
        },
        [leadId, saveMutation, setFiles, td],
    );

    return {
        uploadFiles,
        isUploading: isUploading || saveMutation.isPending,
        uploadProgress,
    };
}
