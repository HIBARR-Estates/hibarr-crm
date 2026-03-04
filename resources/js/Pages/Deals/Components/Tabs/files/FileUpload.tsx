import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client";
import { Modal, Upload, Button, Progress, message } from "antd";
import { InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { useState, useCallback, useRef } from "react";
import type { UploadProps, UploadFile } from "antd";
import { ApiResponse } from "@/lib/api/types";
import { getFileUploadService } from "@/Services/FileUploadService";
import { IUploadResponseItem } from "@/Types/uploads";

const { Dragger } = Upload;

interface Props extends IModalProps {
    deal: Deal;
    onFileUploaded?: () => void;
}

interface StoreExternalPayload {
    deal_id: number;
    files: IUploadResponseItem[];
}

interface StoreExternalResponse {
    message: string;
    data: any[];
}

const FileUpload: React.FC<Props> = ({
    deal,
    onClose,
    open,
    onFileUploaded,
}) => {
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const uploadServiceRef = useRef(getFileUploadService());

    // Mutation to save file references to the backend after external upload
    const saveMutation = useApiMutate<
        StoreExternalPayload,
        StoreExternalResponse,
        ApiResponse<StoreExternalResponse>
    >(route("deal-files.store-external"), "POST", (response) => {
        if (response?.status === "success") {
            setFileList([]);
            setUploadProgress(0);
            onClose();
            if (onFileUploaded) {
                onFileUploaded();
            }
        }
    });

    const uploadProps: UploadProps = {
        name: "file",
        multiple: true,
        fileList,
        beforeUpload: (file) => {
            // Add file to list but don't auto upload
            setFileList((prev) => [...prev, file]);
            return false; // Prevent auto upload
        },
        onRemove: (file) => {
            if (uploading) return; // Don't allow removal during upload
            setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
        },
        showUploadList: {
            showRemoveIcon: !uploading,
            removeIcon: "Remove",
        },
    };

    const handleUpload = useCallback(async () => {
        if (fileList.length === 0) return;

        setUploading(true);
        setUploadProgress(0);

        try {
            // Extract raw File objects from the UploadFile list
            const rawFiles: File[] = fileList
                .map((f) => f.originFileObj || (f as any))
                .filter((f): f is File => f instanceof File);

            if (rawFiles.length === 0) {
                message.error("No valid files to upload");
                setUploading(false);
                return;
            }

            // Step 1: Upload files to external storage API
            const uploadService = uploadServiceRef.current;
            let completedCount = 0;

            const results: IUploadResponseItem[] = [];
            for (const file of rawFiles) {
                const result = await uploadService.uploadSingle(
                    file,
                    "deal-files",
                    (_fileId, progress) => {
                        // Calculate aggregate progress
                        const fileProgress = progress / rawFiles.length;
                        const baseProgress =
                            (completedCount / rawFiles.length) * 100;
                        setUploadProgress(
                            Math.round(baseProgress + fileProgress),
                        );
                    },
                );
                results.push(result);
                completedCount++;
                setUploadProgress(
                    Math.round((completedCount / rawFiles.length) * 100),
                );
            }

            // Step 2: Save file references to the backend
            saveMutation.mutate({
                deal_id: deal.id,
                files: results.map((r) => ({
                    downloadUrl: r.downloadUrl,
                    objectPath: r.objectPath,
                    originalName: r.originalName,
                    size: 0, // Size not returned by external API — fine for now
                })),
            } as any);
        } catch (error: any) {
            console.error("File upload failed:", error);
            message.error(
                error?.message || "Failed to upload files. Please try again.",
            );
        } finally {
            setUploading(false);
        }
    }, [fileList, deal.id, saveMutation]);

    const handleCancel = () => {
        if (uploading) {
            // Cancel any in-progress uploads
            uploadServiceRef.current.cancelAll();
            setUploading(false);
        }
        setFileList([]);
        setUploadProgress(0);
        onClose();
    };

    const isLoading = uploading || saveMutation.isPending;

    return (
        <Modal
            title="Upload Files"
            open={open}
            onCancel={handleCancel}
            footer={[
                <Button
                    key="cancel"
                    onClick={handleCancel}
                    disabled={isLoading}
                >
                    Cancel
                </Button>,
                <Button
                    key="upload"
                    type="primary"
                    icon={<UploadOutlined />}
                    loading={isLoading}
                    onClick={handleUpload}
                    disabled={fileList.length === 0 || isLoading}
                >
                    {isLoading ? "Uploading..." : "Upload Files"}
                </Button>,
            ]}
            destroyOnClose
            width={600}
        >
            <div className="mb-4">
                <Dragger {...uploadProps} className="upload-dragger">
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined
                            style={{ fontSize: "48px", color: "#1890ff" }}
                        />
                    </p>
                    <p className="ant-upload-text text-lg font-medium">
                        Click or drag files to this area to upload
                    </p>
                    <p className="ant-upload-hint text-gray-500">
                        Support for multiple files. You can select multiple
                        files at once.
                    </p>
                </Dragger>
            </div>

            {/* Upload Progress */}
            {uploading && (
                <div className="mb-4">
                    <Progress
                        percent={uploadProgress}
                        status="active"
                        strokeColor={{
                            "0%": "#108ee9",
                            "100%": "#87d068",
                        }}
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                        Uploading {fileList.length} file
                        {fileList.length > 1 ? "s" : ""} to storage...
                    </p>
                </div>
            )}

            {fileList.length > 0 && !uploading && (
                <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Selected Files ({fileList.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto">
                        {fileList.map((file, index) => (
                            <div
                                key={file.uid}
                                className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded mb-1"
                            >
                                <span className="text-sm truncate">
                                    {file.name}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                    {(file.size! / 1024 / 1024).toFixed(2)} MB
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default FileUpload;
