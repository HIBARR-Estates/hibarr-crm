/**
 * FileUploader Component
 *
 * A composable file upload component built on Ant Design's Upload component.
 * Integrates with useFileUpload hook for:
 * - Per-file progress tracking
 * - Aggregate progress display
 * - Cancel/abort support
 * - Configurable validation
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
    Upload,
    Progress,
    Button,
    Typography,
    Space,
    Tooltip,
    List,
    message,
} from "antd";
import type { UploadProps, UploadFile, RcFile } from "antd/es/upload/interface";
import {
    InboxOutlined,
    UploadOutlined,
    DeleteOutlined,
    CloseCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    LoadingOutlined,
    PauseCircleOutlined,
} from "@ant-design/icons";
import { useFileUpload } from "@/Hooks/useFileUpload";
import {
    IFileUploaderProps,
    IUploadProgress,
    IUploadResponseItem,
    IUseFileUploadReturn,
    UploadStatus,
} from "@/Types/uploads";
import { formatFileSize } from "@/lib/config";

const { Dragger } = Upload;
const { Text } = Typography;

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Status icon for upload progress
 */
const StatusIcon: React.FC<{ status: UploadStatus }> = ({ status }) => {
    switch (status) {
        case "pending":
            return <LoadingOutlined className="text-gray-400" />;
        case "uploading":
            return <LoadingOutlined className="text-blue-500" spin />;
        case "success":
            return <CheckCircleOutlined className="text-green-500" />;
        case "error":
            return <ExclamationCircleOutlined className="text-red-500" />;
        case "cancelled":
            return <PauseCircleOutlined className="text-orange-500" />;
        default:
            return null;
    }
};

/**
 * Individual file progress item
 */
interface FileProgressItemProps {
    progress: IUploadProgress;
    onCancel: (fileId: string) => void;
    onRemove: (fileId: string) => void;
}

const FileProgressItem: React.FC<FileProgressItemProps> = ({
    progress,
    onCancel,
    onRemove,
}) => {
    const {
        fileId,
        fileName,
        progress: progressPercent,
        status,
        error,
        response,
    } = progress;

    const canCancel = status === "uploading" || status === "pending";
    const isComplete =
        status === "success" || status === "error" || status === "cancelled";

    return (
        <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md mb-2">
            <StatusIcon status={status} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <Text
                        ellipsis={{ tooltip: fileName }}
                        className="text-sm font-medium max-w-[200px]"
                    >
                        {fileName}
                    </Text>
                    <Text type="secondary" className="text-xs ml-2">
                        {progressPercent}%
                    </Text>
                </div>

                {status === "uploading" && (
                    <Progress
                        percent={progressPercent}
                        size="small"
                        showInfo={false}
                        strokeColor="#1890ff"
                    />
                )}

                {status === "success" && response && (
                    <Text type="secondary" className="text-xs truncate block">
                        Uploaded successfully
                    </Text>
                )}

                {status === "error" && error && (
                    <Text type="danger" className="text-xs">
                        {error}
                    </Text>
                )}

                {status === "cancelled" && (
                    <Text type="warning" className="text-xs">
                        Upload cancelled
                    </Text>
                )}
            </div>

            <div className="flex items-center gap-1">
                {canCancel && (
                    <Tooltip title="Cancel upload">
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => onCancel(fileId)}
                            className="text-gray-400 hover:text-red-500"
                        />
                    </Tooltip>
                )}
                {isComplete && (
                    <Tooltip title="Remove">
                        <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => onRemove(fileId)}
                            className="text-gray-400 hover:text-red-500"
                        />
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

/**
 * Aggregate progress bar for multiple uploads
 */
interface AggregateProgressProps {
    totalFiles: number;
    completedFiles: number;
    overallProgress: number;
    isUploading: boolean;
    onCancelAll: () => void;
}

const AggregateProgress: React.FC<AggregateProgressProps> = ({
    totalFiles,
    completedFiles,
    overallProgress,
    isUploading,
    onCancelAll,
}) => {
    if (totalFiles === 0) return null;

    return (
        <div className="bg-blue-50 rounded-md p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm">
                    {isUploading
                        ? `Uploading ${completedFiles}/${totalFiles} files...`
                        : `${completedFiles}/${totalFiles} files completed`}
                </Text>
                {isUploading && (
                    <Button
                        type="link"
                        size="small"
                        danger
                        onClick={onCancelAll}
                    >
                        Cancel All
                    </Button>
                )}
            </div>
            <Progress
                percent={overallProgress}
                status={isUploading ? "active" : undefined}
                strokeColor={{
                    "0%": "#108ee9",
                    "100%": "#87d068",
                }}
            />
        </div>
    );
};

// ============================================================================
// FileUploader Component
// ============================================================================

/**
 * FileUploader component for handling file uploads with progress tracking
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FileUploader
 *   targetFolder="my-uploads"
 *   onSuccess={(response) => console.log('Uploaded:', response)}
 * />
 *
 * // Multiple files with custom options
 * <FileUploader
 *   multiple
 *   maxFiles={5}
 *   accept="image/*,.pdf"
 *   maxSize={5 * 1024 * 1024}
 *   onSuccess={(responses) => console.log('All uploaded:', responses)}
 *   onError={(error, fileName) => console.error('Failed:', fileName)}
 * />
 *
 * // With external hook for shared state
 * const uploadState = useFileUpload({ maxConcurrent: 2 });
 * <FileUploader uploadHook={uploadState} />
 * ```
 */
export const FileUploader: React.FC<IFileUploaderProps> = ({
    targetFolder = "backend-uploads",
    multiple = false,
    accept,
    maxSize,
    maxFiles,
    maxConcurrent,
    onSuccess,
    onError,
    onCancel,
    onChange,
    showProgress = true,
    uploadHook,
    disabled = false,
    className = "",
    children,
    listType = "text",
    showUploadList = false,
}) => {
    // Use provided hook or create internal one
    const internalHook = useFileUpload({
        maxConcurrent,
        maxFileSize: maxSize,
        targetFolder,
        onSuccess: (response) => {
            if (!multiple) {
                onSuccess?.(response);
            }
        },
        onError,
        onCancel,
    });

    const hook = uploadHook || internalHook;

    const {
        uploadSingle,
        uploadMultiple,
        cancel,
        cancelAll,
        progressMap,
        aggregateProgress,
        isUploading,
        validateFile,
        reset,
    } = hook;

    // Local state for selected files (before upload starts)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadedResponses, setUploadedResponses] = useState<
        IUploadResponseItem[]
    >([]);

    // Convert progress map to array for rendering
    const progressList = useMemo(
        () => Array.from(progressMap.values()),
        [progressMap],
    );

    // ========================================================================
    // Handlers
    // ========================================================================

    /**
     * Handle file selection before upload
     */
    const handleBeforeUpload = useCallback(
        (file: RcFile, fileList: RcFile[]): boolean => {
            // Validate file
            const validation = validateFile(file);
            if (!validation.valid) {
                message.error(validation.error);
                return false;
            }

            // Check max files limit
            if (maxFiles && selectedFiles.length + 1 > maxFiles) {
                message.warning(`Maximum ${maxFiles} files allowed`);
                return false;
            }

            // Add to selected files
            setSelectedFiles((prev) => [...prev, file]);
            onChange?.([...selectedFiles, file]);

            // Prevent default upload behavior
            return false;
        },
        [validateFile, maxFiles, selectedFiles, onChange],
    );

    /**
     * Handle file removal from selection
     */
    const handleRemove = useCallback((file: UploadFile): boolean => {
        setSelectedFiles((prev) =>
            prev.filter((f) => f.name !== file.name || f.size !== file.size),
        );
        return true;
    }, []);

    /**
     * Handle upload button click
     */
    const handleUpload = useCallback(async () => {
        if (selectedFiles.length === 0) return;

        try {
            if (multiple && selectedFiles.length > 1) {
                const results = await uploadMultiple(
                    selectedFiles,
                    targetFolder,
                );
                setUploadedResponses((prev) => [...prev, ...results]);
                onSuccess?.(results);
            } else {
                const result = await uploadSingle(
                    selectedFiles[0],
                    targetFolder,
                );
                setUploadedResponses((prev) => [...prev, result]);
                if (!multiple) {
                    onSuccess?.(result);
                }
            }
            setSelectedFiles([]);
        } catch (error) {
            // Error handling is done in the hook via onError callback
            console.error("Upload failed:", error);
        }
    }, [
        selectedFiles,
        multiple,
        uploadSingle,
        uploadMultiple,
        targetFolder,
        onSuccess,
    ]);

    /**
     * Remove a file from progress list
     */
    const handleRemoveFromProgress = useCallback((fileId: string) => {
        // This triggers a reset for the specific file in progress map
        // For now, we can just ignore it as it will be cleaned up on next upload
    }, []);

    /**
     * Clear all state
     */
    const handleClear = useCallback(() => {
        setSelectedFiles([]);
        setUploadedResponses([]);
        reset();
    }, [reset]);

    // ========================================================================
    // Upload Props
    // ========================================================================

    const uploadProps: UploadProps = {
        name: "file",
        multiple,
        accept,
        disabled: disabled || isUploading,
        fileList: selectedFiles.map((file) => ({
            uid: `${file.name}-${file.size}`,
            name: file.name,
            size: file.size,
            type: file.type,
            status: "done" as const,
            originFileObj: file as RcFile,
        })),
        beforeUpload: handleBeforeUpload,
        onRemove: handleRemove,
        showUploadList: showUploadList
            ? {
                  showRemoveIcon: !isUploading,
                  removeIcon: <DeleteOutlined />,
              }
            : false,
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className={`file-uploader ${className}`}>
            {/* Upload Area */}
            {children ? (
                <Upload {...uploadProps}>{children}</Upload>
            ) : (
                <Dragger {...uploadProps} className="upload-dragger">
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined
                            style={{ fontSize: "48px", color: "#1890ff" }}
                        />
                    </p>
                    <p className="ant-upload-text text-lg font-medium">
                        Click or drag files to this area
                    </p>
                    <p className="ant-upload-hint text-gray-500">
                        {multiple
                            ? `Support for multiple files${maxFiles ? ` (max ${maxFiles})` : ""}.`
                            : "Single file upload."}
                        {maxSize && ` Max size: ${formatFileSize(maxSize)}`}
                    </p>
                </Dragger>
            )}

            {/* Selected Files Count */}
            {selectedFiles.length > 0 && !showUploadList && (
                <div className="mt-3 text-sm text-gray-600">
                    {selectedFiles.length} file
                    {selectedFiles.length > 1 ? "s" : ""} selected
                </div>
            )}

            {/* Upload Button */}
            {selectedFiles.length > 0 && (
                <div className="mt-4 flex gap-2">
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        loading={isUploading}
                        onClick={handleUpload}
                        disabled={disabled}
                    >
                        {isUploading
                            ? "Uploading..."
                            : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`}
                    </Button>
                    <Button
                        onClick={() => setSelectedFiles([])}
                        disabled={isUploading}
                    >
                        Clear
                    </Button>
                </div>
            )}

            {/* Progress Section */}
            {showProgress && progressList.length > 0 && (
                <div className="mt-4">
                    {/* Aggregate Progress */}
                    {multiple && progressList.length > 1 && (
                        <AggregateProgress
                            totalFiles={aggregateProgress.totalFiles}
                            completedFiles={aggregateProgress.completedFiles}
                            overallProgress={aggregateProgress.overallProgress}
                            isUploading={aggregateProgress.isUploading}
                            onCancelAll={cancelAll}
                        />
                    )}

                    {/* Individual File Progress */}
                    <div className="max-h-60 overflow-y-auto">
                        {progressList.map((progress) => (
                            <FileProgressItem
                                key={progress.fileId}
                                progress={progress}
                                onCancel={cancel}
                                onRemove={handleRemoveFromProgress}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUploader;
