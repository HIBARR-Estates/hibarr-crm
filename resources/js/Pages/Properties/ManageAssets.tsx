import React, { useState, useCallback, useMemo } from "react";
import { router } from "@inertiajs/react";
import { Property, PropertyAsset, Pagination } from "@/Types";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import {
    Button,
    Space,
    Segmented,
    Upload,
    Modal,
    Select,
    Progress,
    Alert,
    Typography,
    message,
} from "antd";
import {
    AppstoreOutlined,
    UnorderedListOutlined,
    UploadOutlined,
    PlusOutlined,
    LoadingOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import AssetGridView from "@/Features/Properties/Assets/AssetGridView";
import AssetTableView from "@/Features/Properties/Assets/AssetTableView";
import AssetPreviewModal from "@/Features/Properties/Assets/AssetPreviewModal";
import BulkAssetActionSelector from "@/Features/Properties/Assets/BulkActions/BulkAssetActionSelector";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import createPropertyAssetFilterConfig from "@/configs/propertyAssetFilterConfig";
import { getFileUploadService } from "@/Services/FileUploadService";
import { IUploadResponseItem, IUploadProgress } from "@/Types/uploads";
import type { UploadFile } from "antd";

const { Text } = Typography;

interface ManageAssetsProps {
    pageTitle: string;
    property: Property;
    assets: Pagination<PropertyAsset>;
    availableTags: Record<string, string>;
    availableTypes: Record<string, string>;
    filters: {
        asset_type?: string;
        tags?: string[];
        search?: string;
        sort_by?: string;
        sort_order?: string;
    };
}

// Track upload status for each file
interface FileUploadStatus {
    fileId: string;
    fileName: string;
    progress: number;
    status: "pending" | "uploading" | "success" | "error";
    error?: string;
    response?: IUploadResponseItem;
}

const ManageAssets = ({
    pageTitle,
    property,
    assets,
    availableTags,
    availableTypes,
    filters,
}: ManageAssetsProps) => {
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [selectedAssets, setSelectedAssets] = useState<number[]>([]);
    const [previewAsset, setPreviewAsset] = useState<PropertyAsset | null>(
        null,
    );
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);

    // Upload progress tracking
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>(
        [],
    );
    const [selectedAssetType, setSelectedAssetType] = useState<
        "image" | "video"
    >("image");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const breadcrumbs = [
        { name: "Properties", url: route("properties.index") },
        {
            name: property.title || property.reference_code || "Property",
            url: route("properties.show", property.id),
        },
        { name: "Manage Assets" },
    ];

    const filterConfig = createPropertyAssetFilterConfig(
        availableTags,
        availableTypes,
    );

    // Initialize the file upload service with property-specific folder
    const uploadService = useMemo(() => {
        return getFileUploadService({
            defaultTargetFolder: `properties/${property.id}/assets`,
            allowedTypes: [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "video/mp4",
                "video/webm",
                "video/quicktime",
            ],
            maxFileSize: 50 * 1024 * 1024, // 50MB for videos
        });
    }, [property.id]);

    // Mutation to save asset URLs to the backend
    interface SaveAssetsPayload {
        assets: Array<{
            url: string;
            name: string;
            object_path: string | null;
            asset_type: "image" | "video";
            mime_type?: string;
            file_size?: number;
        }>;
        tags: string[];
    }

    interface SaveAssetsResponse {
        assets: PropertyAsset[];
    }

    const { mutate: saveAssetsToBackend, isPending: isSavingToBackend } =
        useApiMutate<
            SaveAssetsPayload,
            SaveAssetsResponse,
            ApiSuccessResponse<SaveAssetsResponse>
        >(
            route("properties.assets.store_from_urls", property.id),
            "POST",
            () => {
                // Reset state and refresh
                setIsUploadModalOpen(false);
                setUploadFileList([]);
                setUploadStatuses([]);
                setSelectedTags([]);
                router.reload({ only: ["assets"] });
            },
        );

    // Handle asset selection
    const handleAssetSelect = (assetId: number, checked: boolean) => {
        setSelectedAssets((prev) =>
            checked ? [...prev, assetId] : prev.filter((id) => id !== assetId),
        );
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedAssets(checked ? assets.data.map((a) => a.id) : []);
    };

    // Handle file upload using FileUploadService
    const handleUpload = useCallback(async () => {
        if (uploadFileList.length === 0) {
            message.warning("Please select files to upload");
            return;
        }

        // Get actual File objects from UploadFile list
        const files: File[] = [];
        for (const f of uploadFileList) {
            if (f.originFileObj) {
                files.push(f.originFileObj as File);
            }
        }

        if (files.length === 0) {
            message.error("No valid files to upload");
            return;
        }

        // Initialize upload statuses
        const initialStatuses: FileUploadStatus[] = files.map(
            (file, index) => ({
                fileId: `file-${index}-${file.name}`,
                fileName: file.name,
                progress: 0,
                status: "pending",
            }),
        );
        setUploadStatuses(initialStatuses);
        setIsUploading(true);

        const successfulUploads: IUploadResponseItem[] = [];
        const fileMetadata: Map<string, { mimeType: string; size: number }> =
            new Map();

        // Store metadata for each file
        files.forEach((file, index) => {
            fileMetadata.set(`file-${index}-${file.name}`, {
                mimeType: file.type,
                size: file.size,
            });
        });

        try {
            // Upload files to external service with progress tracking
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = `file-${i}-${file.name}`;

                // Update status to uploading
                setUploadStatuses((prev) =>
                    prev.map((s) =>
                        s.fileId === fileId ? { ...s, status: "uploading" } : s,
                    ),
                );

                try {
                    // Validate file before upload
                    uploadService.validateFile(file);

                    // Upload single file with progress tracking
                    const result = await uploadService.uploadSingle(
                        file,
                        `properties/${property.id}/assets`,
                        (_fileId, progressPercent) => {
                            setUploadStatuses((prev) =>
                                prev.map((s) =>
                                    s.fileId === fileId
                                        ? { ...s, progress: progressPercent }
                                        : s,
                                ),
                            );
                        },
                    );

                    // Update status to success
                    setUploadStatuses((prev) =>
                        prev.map((s) =>
                            s.fileId === fileId
                                ? {
                                      ...s,
                                      status: "success",
                                      progress: 100,
                                      response: result,
                                  }
                                : s,
                        ),
                    );

                    successfulUploads.push(result);
                } catch (error) {
                    // Update status to error
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "Upload failed";
                    setUploadStatuses((prev) =>
                        prev.map((s) =>
                            s.fileId === fileId
                                ? { ...s, status: "error", error: errorMessage }
                                : s,
                        ),
                    );
                }
            }

            // If we have successful uploads, save them to the backend
            if (successfulUploads.length > 0) {
                const assetsToSave = successfulUploads.map((upload, index) => {
                    const fileId = `file-${index}-${upload.originalName}`;
                    const metadata = fileMetadata.get(fileId);

                    // Determine asset type from mime type
                    const isVideo = metadata?.mimeType?.startsWith("video/");

                    return {
                        url: upload.downloadUrl,
                        name: upload.originalName,
                        object_path: upload.objectPath,
                        asset_type: (isVideo ? "video" : "image") as
                            | "image"
                            | "video",
                        mime_type: metadata?.mimeType,
                        file_size: metadata?.size,
                    };
                });

                // Save to backend
                saveAssetsToBackend({
                    assets: assetsToSave,
                    tags: selectedTags,
                });
            } else {
                message.error("All uploads failed. Please try again.");
            }
        } catch (error) {
            message.error("Upload process failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
    }, [
        uploadFileList,
        uploadService,
        property.id,
        selectedTags,
        saveAssetsToBackend,
    ]);

    // Cancel all uploads
    const handleCancelUploads = useCallback(() => {
        uploadService.cancelAll();
        setIsUploading(false);
        setUploadStatuses([]);
        message.info("Uploads cancelled");
    }, [uploadService]);

    // Close modal and reset state
    const handleCloseModal = useCallback(() => {
        if (isUploading) {
            handleCancelUploads();
        }
        setIsUploadModalOpen(false);
        setUploadFileList([]);
        setUploadStatuses([]);
        setSelectedTags([]);
    }, [isUploading, handleCancelUploads]);

    const handlePaginationChange = (page: number, pageSize: number) => {
        router.get(
            route("properties.assets.index", property.id),
            {
                ...filters,
                page,
                per_page: pageSize,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    // Calculate overall progress
    const overallProgress = useMemo(() => {
        if (uploadStatuses.length === 0) return 0;
        const totalProgress = uploadStatuses.reduce(
            (sum, s) => sum + s.progress,
            0,
        );
        return Math.round(totalProgress / uploadStatuses.length);
    }, [uploadStatuses]);

    const completedCount = uploadStatuses.filter(
        (s) => s.status === "success",
    ).length;
    const failedCount = uploadStatuses.filter(
        (s) => s.status === "error",
    ).length;

    return (
        <>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Actions Bar */}
                    <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                        <Space size="middle">
                            <Button
                                type="primary"
                                icon={<UploadOutlined />}
                                onClick={() => setIsUploadModalOpen(true)}
                            >
                                Upload Assets
                            </Button>

                            {selectedAssets.length > 0 && (
                                <BulkAssetActionSelector
                                    selectedEntityIds={selectedAssets}
                                    propertyId={property.id}
                                    availableTags={availableTags}
                                    clearSelected={() => setSelectedAssets([])}
                                />
                            )}

                            <UniversalFilterDrawer config={filterConfig} />
                        </Space>

                        <Segmented
                            value={viewMode}
                            onChange={(value) => setViewMode(value as any)}
                            options={[
                                {
                                    value: "grid",
                                    icon: <AppstoreOutlined />,
                                },
                                {
                                    value: "table",
                                    icon: <UnorderedListOutlined />,
                                },
                            ]}
                        />
                    </div>

                    {/* Asset Display */}
                    {viewMode === "grid" ? (
                        <AssetGridView
                            assets={assets.data}
                            selectedAssets={selectedAssets}
                            onAssetClick={setPreviewAsset}
                            onAssetSelect={handleAssetSelect}
                            onSelectAll={handleSelectAll}
                        />
                    ) : (
                        <AssetTableView
                            assets={assets.data}
                            selectedAssets={selectedAssets}
                            pagination={{
                                current: assets.current_page,
                                pageSize: assets.per_page,
                                total: assets.total,
                                onChange: handlePaginationChange,
                            }}
                            onAssetClick={setPreviewAsset}
                            onAssetSelect={handleAssetSelect}
                            onSelectAll={handleSelectAll}
                        />
                    )}

                    {/* Grid Pagination */}
                    {viewMode === "grid" && assets.data.length > 0 && (
                        <div className="mt-6 flex justify-center">
                            <Space>
                                <Button
                                    disabled={!assets.prev_page_url}
                                    onClick={() =>
                                        handlePaginationChange(
                                            assets.current_page - 1,
                                            assets.per_page,
                                        )
                                    }
                                >
                                    Previous
                                </Button>
                                <span className="px-4">
                                    Page {assets.current_page} of{" "}
                                    {assets.last_page}
                                </span>
                                <Button
                                    disabled={!assets.next_page_url}
                                    onClick={() =>
                                        handlePaginationChange(
                                            assets.current_page + 1,
                                            assets.per_page,
                                        )
                                    }
                                >
                                    Next
                                </Button>
                            </Space>
                        </div>
                    )}
                </div>

                {/* Upload Modal */}
                <Modal
                    title="Upload Assets"
                    open={isUploadModalOpen}
                    onCancel={handleCloseModal}
                    footer={
                        isUploading || isSavingToBackend ? (
                            <Space>
                                <Button onClick={handleCancelUploads} danger>
                                    Cancel
                                </Button>
                            </Space>
                        ) : (
                            <Space>
                                <Button onClick={handleCloseModal}>
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={handleUpload}
                                    disabled={uploadFileList.length === 0}
                                >
                                    Upload{" "}
                                    {uploadFileList.length > 0 &&
                                        `(${uploadFileList.length})`}
                                </Button>
                            </Space>
                        )
                    }
                    width={700}
                    maskClosable={!isUploading && !isSavingToBackend}
                    closable={!isUploading && !isSavingToBackend}
                >
                    {/* Upload Progress Section */}
                    {(isUploading || isSavingToBackend) && (
                        <div className="mb-6">
                            <div className="mb-3">
                                <Text strong>
                                    {isSavingToBackend
                                        ? "Saving to property..."
                                        : `Uploading ${uploadStatuses.length} file(s)...`}
                                </Text>
                            </div>
                            <Progress
                                percent={
                                    isSavingToBackend ? 100 : overallProgress
                                }
                                status={
                                    isSavingToBackend
                                        ? "active"
                                        : failedCount > 0 &&
                                            completedCount === 0
                                          ? "exception"
                                          : "active"
                                }
                                format={() =>
                                    isSavingToBackend
                                        ? "Saving..."
                                        : `${completedCount}/${uploadStatuses.length}`
                                }
                            />

                            {/* Individual file statuses */}
                            <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                                {uploadStatuses.map((status) => (
                                    <div
                                        key={status.fileId}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        {status.status === "uploading" && (
                                            <LoadingOutlined className="text-blue-500" />
                                        )}
                                        {status.status === "success" && (
                                            <CheckCircleOutlined className="text-green-500" />
                                        )}
                                        {status.status === "error" && (
                                            <CloseCircleOutlined className="text-red-500" />
                                        )}
                                        {status.status === "pending" && (
                                            <span className="w-4 h-4 rounded-full bg-gray-300" />
                                        )}
                                        <span className="truncate flex-1">
                                            {status.fileName}
                                        </span>
                                        {status.status === "uploading" && (
                                            <span className="text-gray-500">
                                                {status.progress}%
                                            </span>
                                        )}
                                        {status.status === "error" && (
                                            <span className="text-red-500 text-xs truncate max-w-[150px]">
                                                {status.error}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* File Selection Section */}
                    {!isUploading && !isSavingToBackend && (
                        <>
                            <div className="mb-4">
                                <Text className="block mb-2">
                                    Tags (optional)
                                </Text>
                                <Select
                                    mode="multiple"
                                    placeholder="Select tags to apply to all uploaded assets"
                                    value={selectedTags}
                                    onChange={setSelectedTags}
                                    className="w-full"
                                    options={Object.entries(availableTags).map(
                                        ([value, label]) => ({
                                            value,
                                            label,
                                        }),
                                    )}
                                />
                            </div>

                            <Upload
                                listType="picture-card"
                                fileList={uploadFileList}
                                onChange={({ fileList }) =>
                                    setUploadFileList(fileList)
                                }
                                beforeUpload={() => false}
                                multiple
                                accept="image/*,video/*"
                            >
                                <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>Upload</div>
                                </div>
                            </Upload>

                            <Alert
                                type="info"
                                showIcon
                                className="mt-4"
                                message="Upload Info"
                                description="Files will be uploaded to our secure cloud storage. Supported formats: JPEG, PNG, GIF, WebP, MP4, WebM. Maximum file size: 50MB."
                            />
                        </>
                    )}
                </Modal>

                {/* Preview Modal */}
                <AssetPreviewModal
                    open={!!previewAsset}
                    asset={previewAsset}
                    allAssets={assets.data}
                    propertyId={property.id}
                    availableTags={availableTags}
                    onClose={() => setPreviewAsset(null)}
                    onNavigate={setPreviewAsset}
                />
            </PageLayout>
        </>
    );
};
ManageAssets.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default ManageAssets;
