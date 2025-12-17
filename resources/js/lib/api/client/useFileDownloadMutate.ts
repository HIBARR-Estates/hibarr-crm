import axios, { AxiosRequestConfig, AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthType } from "@/Types";
import { usePage } from "@inertiajs/react";
import { App } from "antd";
import download from "js-file-download";

type AllowedHttpMethod = "POST" | "GET";

interface FileDownloadOptions {
    filename?: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

const downloadFile = async <Payload>(props: {
    data?: Payload;
    path: string;
    auth?: AuthType;
    method: AllowedHttpMethod;
    filename?: string;
}): Promise<{ data: Blob; filename: string }> => {
    const { method, auth, data, path, filename } = props;
    const url = `${path}`;
    const config: AxiosRequestConfig = {
        headers: {
            Accept: "application/pdf",
            "Content-Type": "application/json",
            "X-COMPANY-ID": auth?.user.company_id || "",
        },
        method,
        data,
        url,
        responseType: "blob",
    };

    try {
        const response = await axios.request<Blob>(config);
        
        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers["content-disposition"];
        let extractedFilename = filename || "download.pdf";
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                extractedFilename = filenameMatch[1];
            }
        }

        return {
            data: response.data,
            filename: extractedFilename,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            throw new Error(
                axiosError.response?.statusText || "Failed to download file"
            );
        }
        throw new Error("An unexpected error occurred during file download");
    }
};

export const useFileDownloadMutate = <Payload = Record<string, any>>(
    path: string,
    method: AllowedHttpMethod = "POST",
    options?: FileDownloadOptions
) => {
    const { props } = usePage();
    const { auth } = props;

    const queryClient = useQueryClient();
    const { message } = App.useApp();

    return useMutation({
        mutationKey: [path, method, "file-download"],
        mutationFn: (payload: Payload) => {
            return downloadFile<Payload>({
                data: payload,
                path,
                auth,
                method,
                filename: options?.filename,
            });
        },
        onSuccess: (response) => {
            // Trigger the download
            download(response.data, response.filename);

            // Show success message
            message.success("File downloaded successfully");

            // Execute callback
            options?.onSuccess?.();
        },
        onError: (error: Error) => {
            // Show error message
            message.error(error.message || "Failed to download file");

            // Execute error callback
            options?.onError?.(error);
        },
    });
};
