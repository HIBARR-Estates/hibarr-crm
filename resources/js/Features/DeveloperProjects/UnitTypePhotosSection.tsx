/**
 * UnitTypePhotosSection — upload & manage photos for a unit type.
 *
 * Mirrors ConstructionProjectPhotosSection but targets unit-type-level assets.
 * When no unitTypeId is available (create mode), shows a placeholder with
 * an optional "Save & Continue" button.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
    Button,
    Select,
    Upload,
    Modal,
    Typography,
    Image,
    Tag,
    Progress,
    Empty,
    Space,
    App,
    Spin,
    Checkbox,
} from "antd";
import {
    UploadOutlined,
    CameraOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    EditOutlined,
    SaveOutlined,
} from "@ant-design/icons";

import type { UploadFile } from "antd";
import type { DeveloperProjectUnitTypeAsset } from "@/Types/developerProject";
import type { IUploadResponseItem } from "@/Types/uploads";
import { getFileUploadService } from "@/Services/FileUploadService";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "@/lib/api/types";

const { Text, Title } = Typography;

// ────────────────────────────────────────────────────────────
// Tag definitions (same as DeveloperProjectUnitTypeAsset::AVAILABLE_TAGS)
// ────────────────────────────────────────────────────────────
const ASSET_TAGS: Record<string, string> = {
    cover: "Cover Photo",
    interior: "Interior",
    exterior: "Exterior",
    "floor-plan": "Floor Plan",
    gallery: "Gallery",
};

const TAG_OPTIONS = Object.entries(ASSET_TAGS).map(([value, label]) => ({
    value,
    label,
}));

const TAG_COLORS: Record<string, string> = {
    cover: "gold",
    interior: "purple",
    exterior: "orange",
    "floor-plan": "magenta",
    gallery: "lime",
};

// ────────────────────────────────────────────────────────────
// Upload status tracking
// ────────────────────────────────────────────────────────────
interface FileUploadStatus {
    fileId: string;
    fileName: string;
    progress: number;
    status: "pending" | "uploading" | "success" | "error";
    error?: string;
    response?: IUploadResponseItem;
}

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────
interface UnitTypePhotosSectionProps {
    /** Parent project ID — always required for storage paths */
    projectId: number;
    /** Unit type ID — present in edit mode, absent on create */
    unitTypeId?: number;
    /** Callback to trigger a "save & continue" flow so the unit type gets created first */
    onSaveForUpload?: () => void;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
const UnitTypePhotosSection: React.FC<UnitTypePhotosSectionProps> = ({
    projectId,
    unitTypeId,
    onSaveForUpload,
}) => {
    const { message: messageApi } = App.useApp();

    // Upload modal state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>(
        [],
    );

    // Delete confirmation
    const [deleteModal, deleteContextHolder] = Modal.useModal();

    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(
        new Set(),
    );

    // ─── Fetch existing assets ───
    const {
        data: assetsResponse,
        isLoading: isLoadingAssets,
        refetch: refetchAssets,
    } = useApiQuery<{ assets: DeveloperProjectUnitTypeAsset[] }>({
        path:
            unitTypeId && projectId
                ? route("developer-projects.unit-types.assets.index", {
                      projectId,
                      unitTypeId,
                  })
                : "",
        options: { enabled: !!unitTypeId && !!projectId },
    });

    const imageAssets = useMemo(() => {
        const assets = assetsResponse?.assets ?? [];
        return assets.filter((a) => a.asset_type === "image");
    }, [assetsResponse]);

    // Upload service — configured per unit type
    const uploadService = useMemo(() => {
        if (!unitTypeId || !projectId) return null;
        return getFileUploadService({
            defaultTargetFolder: `developer-projects/${projectId}/unit-types/${unitTypeId}/assets`,
            allowedTypes: [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
            ],
            maxFileSize: 50 * 1024 * 1024, // 50 MB
        });
    }, [projectId, unitTypeId]);

    // Mutation: save uploaded file URLs to backend
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

    const { mutate: saveAssetsToBackend, isPending: isSavingToBackend } =
        useApiMutate<
            SaveAssetsPayload,
            { assets: DeveloperProjectUnitTypeAsset[] },
            ApiSuccessResponse<{ assets: DeveloperProjectUnitTypeAsset[] }>
        >(
            unitTypeId && projectId
                ? route(
                      "developer-projects.unit-types.assets.store_from_urls",
                      {
                          projectId,
                          unitTypeId,
                      },
                  )
                : "",
            "POST",
            () => {
                setIsUploadModalOpen(false);
                setUploadFileList([]);
                setUploadStatuses([]);
                setSelectedTags([]);
                refetchAssets();
            },
        );

    const { mutate: bulkDeleteAssets, isPending: isBulkDeleting } =
        useApiMutate<
            { asset_ids: number[] },
            { count: number },
            ApiSuccessResponse<{ count: number }>
        >(
            unitTypeId && projectId
                ? route("developer-projects.unit-types.assets.bulk_destroy", {
                      projectId,
                      unitTypeId,
                  })
                : "",
            "POST",
            () => {
                messageApi.success("Photos deleted");
                refetchAssets();
                setIsSelecting(false);
                setSelectedAssetIds(new Set());
            },
        );

    // ─── Upload flow ───
    const handleUpload = useCallback(async () => {
        if (!uploadService || !unitTypeId || !projectId) return;

        const files: File[] = [];
        for (const f of uploadFileList) {
            if (f.originFileObj) {
                files.push(f.originFileObj as File);
            }
        }

        if (files.length === 0) {
            messageApi.warning("Please select photos to upload");
            return;
        }

        // Initialise statuses
        const initialStatuses: FileUploadStatus[] = files.map((file, i) => ({
            fileId: `file-${i}-${file.name}`,
            fileName: file.name,
            progress: 0,
            status: "pending",
        }));
        setUploadStatuses(initialStatuses);
        setIsUploading(true);

        const successfulUploads: IUploadResponseItem[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = `file-${i}-${file.name}`;

                setUploadStatuses((prev) =>
                    prev.map((s) =>
                        s.fileId === fileId ? { ...s, status: "uploading" } : s,
                    ),
                );

                try {
                    uploadService.validateFile(file);

                    const result = await uploadService.uploadSingle(
                        file,
                        `developer-projects/${projectId}/unit-types/${unitTypeId}/assets`,
                        (_fId, progressPercent) => {
                            setUploadStatuses((prev) =>
                                prev.map((s) =>
                                    s.fileId === fileId
                                        ? { ...s, progress: progressPercent }
                                        : s,
                                ),
                            );
                        },
                    );

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

            // Save successful uploads to backend
            if (successfulUploads.length > 0) {
                const failedCount = files.length - successfulUploads.length;
                if (failedCount > 0) {
                    messageApi.warning(
                        `${failedCount} file(s) failed. ${successfulUploads.length} file(s) will be saved.`,
                    );
                }

                saveAssetsToBackend({
                    assets: successfulUploads.map((upload) => ({
                        url: encodeURI(upload.downloadUrl),
                        name: upload.originalName,
                        object_path: upload.objectPath,
                        asset_type: "image" as const,
                        mime_type: undefined,
                        file_size: undefined,
                    })),
                    tags: selectedTags,
                });
            } else {
                messageApi.error("All uploads failed");
            }
        } finally {
            setIsUploading(false);
        }
    }, [
        uploadService,
        projectId,
        unitTypeId,
        uploadFileList,
        selectedTags,
        saveAssetsToBackend,
        messageApi,
    ]);

    // ─── Delete handler ───
    const handleDeleteAsset = useCallback(
        (asset: DeveloperProjectUnitTypeAsset) => {
            if (!projectId || !unitTypeId) return;

            deleteModal.confirm({
                title: "Delete Photo",
                content: `Delete "${asset.name}"? This cannot be undone.`,
                okText: "Delete",
                okType: "danger",
                onOk: () => {
                    const url = route(
                        "developer-projects.unit-types.assets.destroy",
                        {
                            projectId,
                            unitTypeId,
                            assetId: asset.id,
                        },
                    );

                    fetch(url, {
                        method: "DELETE",
                        headers: {
                            "X-Requested-With": "XMLHttpRequest",
                            "X-CSRF-TOKEN":
                                document
                                    .querySelector('meta[name="csrf-token"]')
                                    ?.getAttribute("content") || "",
                            Accept: "application/json",
                        },
                    })
                        .then((res) => res.json())
                        .then(() => {
                            messageApi.success("Photo deleted");
                            refetchAssets();
                        })
                        .catch(() => {
                            messageApi.error("Failed to delete photo");
                        });
                },
            });
        },
        [projectId, unitTypeId, deleteModal, messageApi, refetchAssets],
    );

    const toggleAssetSelection = useCallback((id: number) => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const selectAllUnitPhotos = useCallback(() => {
        setSelectedAssetIds(new Set(imageAssets.map((a) => a.id)));
    }, [imageAssets]);

    const deselectAllUnitPhotos = useCallback(() => {
        setSelectedAssetIds(new Set());
    }, []);

    const exitUnitSelectionMode = useCallback(() => {
        setIsSelecting(false);
        setSelectedAssetIds(new Set());
    }, []);

    const handleBulkDeleteUnitPhotos = useCallback(() => {
        if (!projectId || !unitTypeId || selectedAssetIds.size === 0) return;
        const ids = Array.from(selectedAssetIds);
        deleteModal.confirm({
            title: `Delete ${ids.length} photo${ids.length !== 1 ? "s" : ""}?`,
            content: "This cannot be undone.",
            okText: "Delete",
            okType: "danger",
            onOk: () =>
                bulkDeleteAssets(
                    { asset_ids: ids },
                    {
                        onError: () =>
                            messageApi.error("Failed to delete photos"),
                    },
                ),
        });
    }, [
        projectId,
        unitTypeId,
        selectedAssetIds,
        deleteModal,
        bulkDeleteAssets,
        messageApi,
    ]);

    // ─── Create mode: unit type not saved yet ───
    if (!unitTypeId) {
        return (
            <div className="text-center py-8">
                <CameraOutlined
                    style={{ fontSize: 48, color: "#d9d9d9" }}
                    className="mb-4"
                />
                <Title level={5} type="secondary">
                    Save the unit type to upload photos
                </Title>
                <Text type="secondary" className="block mb-4">
                    Photos can be uploaded once the unit type has been saved.
                </Text>
                {onSaveForUpload && (
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={onSaveForUpload}
                    >
                        Save & Continue
                    </Button>
                )}
            </div>
        );
    }

    // ─── Edit mode: full upload UI ───
    if (isLoadingAssets) {
        return (
            <div className="flex justify-center py-12">
                <Spin tip="Loading photos..." />
            </div>
        );
    }

    return (
        <div>
            {deleteContextHolder}

            {/* Action bar */}
            <div className="flex items-center justify-between mb-4">
                <Text type="secondary" className="text-sm">
                    {imageAssets.length > 0
                        ? `${imageAssets.length} photo${imageAssets.length !== 1 ? "s" : ""}`
                        : "No photos yet"}
                </Text>
                <Space wrap>
                    {!isSelecting ? (
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => setIsSelecting(true)}
                        >
                            Select
                        </Button>
                    ) : (
                        <>
                            <Button size="small" onClick={selectAllUnitPhotos}>
                                Select All
                            </Button>
                            <Button size="small" onClick={deselectAllUnitPhotos}>
                                Deselect
                            </Button>
                            <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={
                                    selectedAssetIds.size === 0 ||
                                    isBulkDeleting
                                }
                                loading={isBulkDeleting}
                                onClick={handleBulkDeleteUnitPhotos}
                            >
                                Delete ({selectedAssetIds.size})
                            </Button>
                            <Button
                                size="small"
                                onClick={exitUnitSelectionMode}
                            >
                                Cancel
                            </Button>
                        </>
                    )}
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        Upload Photos
                    </Button>
                </Space>
            </div>

            {/* Existing photos grid */}
            {imageAssets.length > 0 ? (
                <Image.PreviewGroup>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {imageAssets.map((asset) => {
                            const isSelected = selectedAssetIds.has(asset.id);
                            return (
                                <div
                                    key={asset.id}
                                    className={`relative group border rounded-lg overflow-hidden cursor-pointer ${
                                        isSelecting && isSelected
                                            ? "border-blue-500 ring-2 ring-blue-300"
                                            : "border-gray-200"
                                    }`}
                                    onClick={
                                        isSelecting
                                            ? () =>
                                                  toggleAssetSelection(
                                                      asset.id,
                                                  )
                                            : undefined
                                    }
                                >
                                    {isSelecting && (
                                        <div className="absolute top-1 left-1 z-10">
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() =>
                                                    toggleAssetSelection(
                                                        asset.id,
                                                    )
                                                }
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            />
                                        </div>
                                    )}

                                    <Image
                                        src={
                                            asset.url ||
                                            asset.external_url ||
                                            ""
                                        }
                                        alt={
                                            asset.name || "Unit type photo"
                                        }
                                        width="100%"
                                        height={120}
                                        style={{ objectFit: "cover" }}
                                        preview={
                                            isSelecting
                                                ? false
                                                : { mask: "Preview" }
                                        }
                                    />

                                    {/* Tags */}
                                    {asset.tags &&
                                        asset.tags.length > 0 && (
                                            <div
                                                className={`absolute flex flex-wrap gap-0.5 ${
                                                    isSelecting
                                                        ? "top-1 left-7"
                                                        : "top-1 left-1"
                                                }`}
                                            >
                                                {asset.tags.map((tag) => (
                                                    <Tag
                                                        key={tag}
                                                        color={
                                                            TAG_COLORS[
                                                                tag
                                                            ] ||
                                                            "default"
                                                        }
                                                        className="text-[10px] leading-tight px-1 py-0"
                                                    >
                                                        {ASSET_TAGS[tag] ||
                                                            tag}
                                                    </Tag>
                                                ))}
                                            </div>
                                        )}

                                    {!isSelecting && (
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                type="primary"
                                                danger
                                                size="small"
                                                icon={<DeleteOutlined />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteAsset(asset);
                                                }}
                                            />
                                        </div>
                                    )}

                                    <div className="px-2 py-1 truncate">
                                        <Text
                                            className="text-xs"
                                            ellipsis
                                        >
                                            {asset.name}
                                        </Text>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Image.PreviewGroup>
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No photos uploaded yet"
                    className="my-4"
                >
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        Upload Your First Photo
                    </Button>
                </Empty>
            )}

            {/* Upload Modal */}
            <Modal
                title="Upload Unit Type Photos"
                open={isUploadModalOpen}
                onCancel={() => {
                    if (!isUploading) {
                        setIsUploadModalOpen(false);
                        setUploadFileList([]);
                        setUploadStatuses([]);
                        setSelectedTags([]);
                    }
                }}
                width={640}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => setIsUploadModalOpen(false)}
                        disabled={isUploading || isSavingToBackend}
                    >
                        Cancel
                    </Button>,
                    <Button
                        key="upload"
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={handleUpload}
                        loading={isUploading || isSavingToBackend}
                        disabled={uploadFileList.length === 0}
                    >
                        {isUploading
                            ? "Uploading..."
                            : isSavingToBackend
                              ? "Saving..."
                              : `Upload ${uploadFileList.length || ""} Photo${uploadFileList.length !== 1 ? "s" : ""}`}
                    </Button>,
                ]}
                maskClosable={!isUploading}
            >
                {/* Tag selector */}
                <div className="mb-4">
                    <Text className="text-sm block mb-1">Tags (optional)</Text>
                    <Select
                        mode="multiple"
                        placeholder="Select tags to apply to all photos"
                        options={TAG_OPTIONS}
                        value={selectedTags}
                        onChange={setSelectedTags}
                        style={{ width: "100%" }}
                        allowClear
                    />
                </div>

                {/* File picker */}
                {uploadStatuses.length === 0 ? (
                    <Upload.Dragger
                        multiple
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        beforeUpload={() => false}
                        fileList={uploadFileList}
                        onChange={({ fileList }) => setUploadFileList(fileList)}
                        listType="picture"
                    >
                        <p className="ant-upload-drag-icon">
                            <CameraOutlined style={{ fontSize: 36 }} />
                        </p>
                        <p className="ant-upload-text">
                            Click or drag photos here
                        </p>
                        <p className="ant-upload-hint text-xs">
                            JPG, PNG, GIF, WebP — up to 50 MB each
                        </p>
                    </Upload.Dragger>
                ) : (
                    /* Upload progress list */
                    <div className="space-y-2">
                        {uploadStatuses.map((us) => (
                            <div
                                key={us.fileId}
                                className="flex items-center gap-2 p-2 border rounded"
                            >
                                {us.status === "success" ? (
                                    <CheckCircleOutlined className="text-green-500" />
                                ) : us.status === "error" ? (
                                    <CloseCircleOutlined className="text-red-500" />
                                ) : null}
                                <div className="flex-1 min-w-0">
                                    <Text ellipsis className="text-sm block">
                                        {us.fileName}
                                    </Text>
                                    {(us.status === "uploading" ||
                                        us.status === "pending") && (
                                        <Progress
                                            percent={us.progress}
                                            size="small"
                                            status="active"
                                        />
                                    )}
                                    {us.error && (
                                        <Text type="danger" className="text-xs">
                                            {us.error}
                                        </Text>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UnitTypePhotosSection;
