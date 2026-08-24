import React, { useState, useMemo, useCallback } from "react";
import {
    Button,
    Card,
    Select,
    Upload,
    Modal,
    Typography,
    Image,
    Tag,
    Progress,
    Empty,
    Space,
    Spin,
    App,
    Segmented,
    Checkbox,
    Radio,
} from "antd";
import {
    UploadOutlined,
    CameraOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    AppstoreOutlined,
    TagsOutlined,
    EditOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import type { UploadFile } from "antd";
import type { AssetTag } from "@/Types";
import type { DeveloperProjectAsset } from "@/Types/developerProject";
import type { IUploadResponseItem } from "@/Types/uploads";
import { getFileUploadService } from "@/Services/FileUploadService";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "@/lib/api/types";
import { usePermission } from "@/lib/permissionUtils";
import { compressImagesForUpload } from "@/lib/compressImageForUpload";

const { Text, Title } = Typography;

// ────────────────────────────────────────────────────────────
// Tag definitions
// ────────────────────────────────────────────────────────────
const ASSET_TAGS: Record<AssetTag, string> = {
    hero: "Hero Image",
    facilities: "Facilities",
    features: "Features",
    area: "Area / Location",
    exterior: "Exterior",
    interior: "Interior",
    "floor-plan": "Floor Plan",
    "site-plan": "Site Plan",
    footer: "Footer",
    gallery: "Gallery",
    cover: "Cover (card / overview hero)",
};

const TAG_OPTIONS = Object.entries(ASSET_TAGS).map(([value, label]) => ({
    value: value as AssetTag,
    label,
}));

const TAG_COLORS: Record<AssetTag, string> = {
    hero: "gold",
    facilities: "blue",
    features: "green",
    area: "cyan",
    exterior: "orange",
    interior: "purple",
    "floor-plan": "magenta",
    "site-plan": "volcano",
    footer: "geekblue",
    gallery: "lime",
    cover: "red",
};

/**
 * Validate DELETE developer-project asset response without assuming JSON.
 * Handles 204 / empty bodies; checks HTTP status and Laravel Reply payloads.
 */
async function assertDeveloperProjectAssetDestroyOk(
    res: Response,
): Promise<void> {
    const raw = await res.text();
    const trimmed = raw.trim();

    let payload: { status?: string; message?: string } | null = null;
    if (trimmed) {
        try {
            payload = JSON.parse(trimmed) as {
                status?: string;
                message?: string;
            };
        } catch {
            if (!res.ok) {
                throw new Error(
                    trimmed.length > 200
                        ? `${trimmed.slice(0, 200)}…`
                        : trimmed,
                );
            }
            return;
        }
    }

    if (!res.ok) {
        throw new Error(
            payload?.message ||
                trimmed ||
                `Delete failed (${res.status} ${res.statusText})`,
        );
    }

    if (payload && payload.status === "fail") {
        throw new Error(payload.message || "Delete failed");
    }
}

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
interface ProjectPhotosSectionProps {
    projectId: number;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
const ProjectPhotosSection: React.FC<ProjectPhotosSectionProps> = ({
    projectId,
}) => {
    const { message: messageApi } = App.useApp();
    const { hasPermission } = usePermission();
    const canEdit = hasPermission("edit_developer_projects");

    // View mode: all photos or grouped by tag
    const [viewMode, setViewMode] = useState<"all" | "by-tag">("all");

    // Filter by tag
    const [filterTag, setFilterTag] = useState<AssetTag | "all">("all");

    // Upload modal state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
    const [selectedTags, setSelectedTags] = useState<AssetTag[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>(
        [],
    );

    // Delete confirmation
    const [deleteModal, deleteContextHolder] = Modal.useModal();

    // Bulk selection
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(
        new Set(),
    );

    // Bulk tag modal
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [bulkTags, setBulkTags] = useState<AssetTag[]>([]);
    const [bulkTagAction, setBulkTagAction] = useState<
        "add" | "replace" | "remove"
    >("add");

    // ─── Fetch all project assets ───
    const {
        data: assetsResponse,
        isLoading,
        refetch: refetchAssets,
    } = useApiQuery<{ status: string; assets: DeveloperProjectAsset[] }>({
        path: route("developer-projects.assets.index", projectId),
        options: { enabled: !!projectId },
    });

    const allAssets = useMemo(
        () => assetsResponse?.assets ?? [],
        [assetsResponse],
    );

    const imageAssets = useMemo(
        () => allAssets.filter((a) => a.asset_type === "image"),
        [allAssets],
    );

    // Filtered assets based on selected tag
    const filteredAssets = useMemo(() => {
        if (filterTag === "all") return imageAssets;
        return imageAssets.filter((a) => a.tags && a.tags.includes(filterTag));
    }, [imageAssets, filterTag]);

    // Assets grouped by tag for "by-tag" view
    const assetsByTag = useMemo(() => {
        const groups: Record<string, DeveloperProjectAsset[]> = {};
        for (const asset of imageAssets) {
            if (asset.tags && asset.tags.length > 0) {
                for (const tag of asset.tags) {
                    if (!groups[tag]) groups[tag] = [];
                    groups[tag].push(asset);
                }
            } else {
                if (!groups["untagged"]) groups["untagged"] = [];
                groups["untagged"].push(asset);
            }
        }
        return groups;
    }, [imageAssets]);

    // Upload service
    const uploadService = useMemo(
        () =>
            getFileUploadService({
                defaultTargetFolder: `developer-projects/${projectId}/assets`,
                allowedTypes: [
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "image/webp",
                ],
                maxFileSize: 50 * 1024 * 1024,
            }),
        [projectId],
    );

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
            { assets: DeveloperProjectAsset[] },
            ApiSuccessResponse<{ assets: DeveloperProjectAsset[] }>
        >(
            route("developer-projects.assets.store_from_urls", projectId),
            "POST",
            () => {
                setIsUploadModalOpen(false);
                setUploadFileList([]);
                setUploadStatuses([]);
                setSelectedTags([]);
                refetchAssets();
                router.reload({ only: ["project"] });
            },
        );

    // Mutation: bulk update tags
    interface BulkUpdateTagsPayload {
        asset_ids: number[];
        tags: string[];
        action: "add" | "replace" | "remove";
    }

    const { mutate: bulkUpdateTags, isPending: isBulkUpdating } = useApiMutate<
        BulkUpdateTagsPayload,
        { updated: number },
        ApiSuccessResponse<{ updated: number }>
    >(
        route("developer-projects.assets.bulk_update_tags", projectId),
        "PUT",
        () => {
            setIsTagModalOpen(false);
            setBulkTags([]);
            setBulkTagAction("add");
            setSelectedAssetIds(new Set());
            setIsSelecting(false);
            refetchAssets();
        },
    );

    // ─── Upload flow ───
    const handleUpload = useCallback(async () => {
        if (!canEdit) return;
        if (!uploadService) return;

        const rawFiles: File[] = [];
        for (const f of uploadFileList) {
            if (f.originFileObj) {
                rawFiles.push(f.originFileObj as File);
            }
        }

        if (rawFiles.length === 0) {
            messageApi.warning("Please select photos to upload");
            return;
        }

        const initialStatuses: FileUploadStatus[] = rawFiles.map((file, i) => ({
            fileId: `file-${i}-${file.name}`,
            fileName: file.name,
            progress: 0,
            status: "pending",
        }));
        setUploadStatuses(initialStatuses);
        setIsUploading(true);

        const successfulUploads: IUploadResponseItem[] = [];

        try {
            const files = await compressImagesForUpload(rawFiles);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = `file-${i}-${rawFiles[i].name}`;

                setUploadStatuses((prev) =>
                    prev.map((s) =>
                        s.fileId === fileId
                            ? {
                                  ...s,
                                  fileName: file.name,
                                  status: "uploading",
                              }
                            : s,
                    ),
                );

                try {
                    uploadService.validateFile(file);

                    const result = await uploadService.uploadSingle(
                        file,
                        `developer-projects/${projectId}/assets`,
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
        canEdit,
        uploadService,
        projectId,
        uploadFileList,
        selectedTags,
        saveAssetsToBackend,
        messageApi,
    ]);

    // ─── Delete handler ───
    const handleDeleteAsset = useCallback(
        (asset: DeveloperProjectAsset) => {
            if (!canEdit) return;

            deleteModal.confirm({
                title: "Delete Photo",
                content: `Delete "${asset.name}"? This cannot be undone.`,
                okText: "Delete",
                okType: "danger",
                onOk: () => {
                    const url = route("developer-projects.assets.destroy", [
                        projectId,
                        asset.id,
                    ]);

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
                        .then((res) =>
                            assertDeveloperProjectAssetDestroyOk(res),
                        )
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
        [canEdit, projectId, deleteModal, messageApi, refetchAssets],
    );

    // ─── Bulk selection helpers ───
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

    const selectAllVisible = useCallback(() => {
        const ids = filteredAssets.map((a) => a.id);
        setSelectedAssetIds(new Set(ids));
    }, [filteredAssets]);

    const deselectAll = useCallback(() => {
        setSelectedAssetIds(new Set());
    }, []);

    const exitSelectionMode = useCallback(() => {
        setIsSelecting(false);
        setSelectedAssetIds(new Set());
    }, []);

    const handleBulkTagSubmit = useCallback(() => {
        if (!canEdit) return;
        if (selectedAssetIds.size === 0 || bulkTags.length === 0) return;
        bulkUpdateTags({
            asset_ids: Array.from(selectedAssetIds),
            tags: bulkTags,
            action: bulkTagAction,
        });
    }, [canEdit, selectedAssetIds, bulkTags, bulkTagAction, bulkUpdateTags]);

    const handleBulkDeleteAssets = useCallback(() => {
        if (!canEdit) return;
        const ids = Array.from(selectedAssetIds);
        if (ids.length === 0) return;

        deleteModal.confirm({
            title: `Delete ${ids.length} photo${ids.length !== 1 ? "s" : ""}?`,
            content: "This cannot be undone.",
            okText: "Delete",
            okType: "danger",
            onOk: async () => {
                const token =
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute("content") || "";
                const results = await Promise.allSettled(
                    ids.map((assetId) =>
                        fetch(
                            route("developer-projects.assets.destroy", [
                                projectId,
                                assetId,
                            ]),
                            {
                                method: "DELETE",
                                headers: {
                                    "X-Requested-With": "XMLHttpRequest",
                                    "X-CSRF-TOKEN": token,
                                    Accept: "application/json",
                                },
                            },
                        ).then((res) =>
                            assertDeveloperProjectAssetDestroyOk(res),
                        ),
                    ),
                );
                const failed = results.filter((r) => r.status === "rejected");
                const ok = results.length - failed.length;
                if (ok > 0) {
                    messageApi.success(
                        ok === results.length
                            ? `${ok} photo${ok !== 1 ? "s" : ""} deleted`
                            : `${ok} deleted, ${failed.length} failed`,
                    );
                    refetchAssets();
                    exitSelectionMode();
                }
                if (failed.length > 0 && ok === 0) {
                    messageApi.error("Failed to delete photos");
                }
            },
        });
    }, [
        canEdit,
        selectedAssetIds,
        projectId,
        deleteModal,
        messageApi,
        refetchAssets,
        exitSelectionMode,
    ]);

    // ─── Photo card renderer ───
    const renderPhotoCard = (asset: DeveloperProjectAsset) => {
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
                        ? () => toggleAssetSelection(asset.id)
                        : undefined
                }
            >
                {/* Selection checkbox overlay */}
                {isSelecting && (
                    <div className="absolute top-1 left-1 z-10">
                        <Checkbox
                            checked={isSelected}
                            onChange={() => toggleAssetSelection(asset.id)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}

                <Image
                    src={asset.url || asset.external_url || ""}
                    alt={asset.name}
                    width="100%"
                    height={160}
                    style={{ objectFit: "cover" }}
                    preview={isSelecting ? false : { mask: "Preview" }}
                />

                {/* Tags */}
                {asset.tags && asset.tags.length > 0 && (
                    <div
                        className={`absolute ${isSelecting ? "top-1 left-7" : "top-1 left-1"} flex flex-wrap gap-0.5`}
                    >
                        {asset.tags.map((tag) => (
                            <Tag
                                key={tag}
                                color={TAG_COLORS[tag] || "default"}
                                className="text-[10px] leading-tight px-1 py-0"
                            >
                                {ASSET_TAGS[tag] || tag}
                            </Tag>
                        ))}
                    </div>
                )}

                {/* Delete overlay */}
                {canEdit && !isSelecting && (
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

                {/* Name */}
                <div className="px-2 py-1 truncate">
                    <Text className="text-xs" ellipsis>
                        {asset.name}
                    </Text>
                </div>
            </div>
        );
    };

    // ─── Loading state ───
    if (isLoading) {
        return (
            <Card>
                <div className="flex justify-center py-12">
                    <Spin tip="Loading photos..." />
                </div>
            </Card>
        );
    }

    // ─── Empty state ───
    if (imageAssets.length === 0) {
        return (
            <Card
                title="Project Photos"
                extra={
                    canEdit ? (
                        <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            Upload Photos
                        </Button>
                    ) : null
                }
            >
                {deleteContextHolder}
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No photos uploaded yet"
                    className="my-8"
                >
                    {canEdit && (
                        <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            Upload Your First Photo
                        </Button>
                    )}
                </Empty>
                {canEdit && renderUploadModal()}
            </Card>
        );
    }

    // ─── Render helpers ───
    function renderUploadModal() {
        return (
            <Modal
                title="Upload Photos"
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
                            JPG, PNG, GIF, WebP — up to 50 MB each. Large images
                            are auto-resized for the web.
                        </p>
                    </Upload.Dragger>
                ) : (
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
        );
    }

    function renderBulkTagModal() {
        return (
            <Modal
                title={`Update Tags — ${selectedAssetIds.size} photo${selectedAssetIds.size !== 1 ? "s" : ""} selected`}
                open={isTagModalOpen}
                onCancel={() => {
                    if (!isBulkUpdating) {
                        setIsTagModalOpen(false);
                        setBulkTags([]);
                        setBulkTagAction("add");
                    }
                }}
                width={480}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => setIsTagModalOpen(false)}
                        disabled={isBulkUpdating}
                    >
                        Cancel
                    </Button>,
                    <Button
                        key="apply"
                        type="primary"
                        onClick={handleBulkTagSubmit}
                        loading={isBulkUpdating}
                        disabled={bulkTags.length === 0}
                    >
                        Apply Tags
                    </Button>,
                ]}
                maskClosable={!isBulkUpdating}
            >
                <div className="mb-4">
                    <Text className="text-sm block mb-1 font-medium">
                        Action
                    </Text>
                    <Radio.Group
                        value={bulkTagAction}
                        onChange={(e) => setBulkTagAction(e.target.value)}
                    >
                        <Radio value="add">Add tags</Radio>
                        <Radio value="remove">Remove tags</Radio>
                        <Radio value="replace">Replace all tags</Radio>
                    </Radio.Group>
                    <div className="mt-1">
                        <Text type="secondary" className="text-xs">
                            {bulkTagAction === "add" &&
                                "Selected tags will be added to existing tags on each photo."}
                            {bulkTagAction === "remove" &&
                                "Selected tags will be removed from each photo."}
                            {bulkTagAction === "replace" &&
                                "All existing tags will be replaced with the selected tags."}
                        </Text>
                    </div>
                </div>

                <div>
                    <Text className="text-sm block mb-1 font-medium">Tags</Text>
                    <Select
                        mode="multiple"
                        placeholder="Select tags"
                        options={TAG_OPTIONS}
                        value={bulkTags}
                        onChange={setBulkTags}
                        style={{ width: "100%" }}
                        allowClear
                    />
                </div>
            </Modal>
        );
    }

    // ─── Main render ───
    return (
        <Card
            title={`Project Photos (${imageAssets.length})`}
            extra={
                <Space>
                    <Segmented
                        size="small"
                        options={[
                            {
                                value: "all",
                                icon: <AppstoreOutlined />,
                                label: "All",
                            },
                            {
                                value: "by-tag",
                                icon: <TagsOutlined />,
                                label: "By Tag",
                            },
                        ]}
                        value={viewMode}
                        onChange={(v) => setViewMode(v as "all" | "by-tag")}
                    />
                    {viewMode === "all" && (
                        <Select
                            size="small"
                            value={filterTag}
                            onChange={setFilterTag}
                            style={{ width: 160 }}
                            options={[
                                { value: "all", label: "All Tags" },
                                ...TAG_OPTIONS,
                            ]}
                        />
                    )}
                    {canEdit &&
                        (!isSelecting ? (
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setIsSelecting(true)}
                            >
                                Select
                            </Button>
                        ) : (
                            <>
                                <Button size="small" onClick={selectAllVisible}>
                                    Select All
                                </Button>
                                <Button size="small" onClick={deselectAll}>
                                    Deselect
                                </Button>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<TagsOutlined />}
                                    disabled={selectedAssetIds.size === 0}
                                    onClick={() => setIsTagModalOpen(true)}
                                >
                                    Edit Tags ({selectedAssetIds.size})
                                </Button>
                                <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    disabled={selectedAssetIds.size === 0}
                                    onClick={handleBulkDeleteAssets}
                                >
                                    Delete ({selectedAssetIds.size})
                                </Button>
                                <Button
                                    size="small"
                                    onClick={exitSelectionMode}
                                >
                                    Cancel
                                </Button>
                            </>
                        ))}
                    {canEdit && (
                        <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            Upload Photos
                        </Button>
                    )}
                </Space>
            }
        >
            {deleteContextHolder}

            {viewMode === "all" ? (
                /* ── Flat grid view ── */
                filteredAssets.length > 0 ? (
                    <Image.PreviewGroup>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filteredAssets.map(renderPhotoCard)}
                        </div>
                    </Image.PreviewGroup>
                ) : (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            filterTag === "all"
                                ? "No photos uploaded yet"
                                : `No photos tagged "${ASSET_TAGS[filterTag]}"`
                        }
                    />
                )
            ) : (
                /* ── Grouped by tag view ── */
                <div className="flex flex-col gap-6">
                    {Object.entries(assetsByTag).map(([tag, assets]) => (
                        <div key={tag}>
                            <div className="flex items-center gap-2 mb-3">
                                <Tag
                                    color={
                                        TAG_COLORS[tag as AssetTag] || "default"
                                    }
                                    className="text-sm"
                                >
                                    {ASSET_TAGS[tag as AssetTag] ||
                                        (tag === "untagged" ? "Untagged" : tag)}
                                </Tag>
                                <Text type="secondary" className="text-sm">
                                    {assets.length} photo
                                    {assets.length !== 1 ? "s" : ""}
                                </Text>
                            </div>
                            <Image.PreviewGroup>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {assets.map(renderPhotoCard)}
                                </div>
                            </Image.PreviewGroup>
                        </div>
                    ))}
                    {Object.keys(assetsByTag).length === 0 && (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No photos uploaded yet"
                        />
                    )}
                </div>
            )}

            {canEdit && renderUploadModal()}
            {canEdit && renderBulkTagModal()}
        </Card>
    );
};

export default ProjectPhotosSection;
