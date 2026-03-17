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
} from "antd";
import {
    UploadOutlined,
    CameraOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    AppstoreOutlined,
    TagsOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";
import type { AssetTag } from "@/Types";
import type { DeveloperProjectAsset } from "@/Types/developerProject";
import type { IUploadResponseItem } from "@/Types/uploads";
import { getFileUploadService } from "@/Services/FileUploadService";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "@/lib/api/types";

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
            },
        );

    // ─── Upload flow ───
    const handleUpload = useCallback(async () => {
        if (!uploadService) return;

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
        [projectId, deleteModal, messageApi, refetchAssets],
    );

    // ─── Photo card renderer ───
    const renderPhotoCard = (asset: DeveloperProjectAsset) => (
        <div
            key={asset.id}
            className="relative group border border-gray-200 rounded-lg overflow-hidden"
        >
            <Image
                src={asset.url || asset.external_url || ""}
                alt={asset.name}
                width="100%"
                height={160}
                style={{ objectFit: "cover" }}
                preview={{ mask: "Preview" }}
            />

            {/* Tags */}
            {asset.tags && asset.tags.length > 0 && (
                <div className="absolute top-1 left-1 flex flex-wrap gap-0.5">
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

            {/* Name */}
            <div className="px-2 py-1 truncate">
                <Text className="text-xs" ellipsis>
                    {asset.name}
                </Text>
            </div>
        </div>
    );

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
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        Upload Photos
                    </Button>
                }
            >
                {deleteContextHolder}
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No photos uploaded yet"
                    className="my-8"
                >
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        Upload Your First Photo
                    </Button>
                </Empty>
                {renderUploadModal()}
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
                            JPG, PNG, GIF, WebP — up to 50 MB each
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
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        Upload Photos
                    </Button>
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

            {renderUploadModal()}
        </Card>
    );
};

export default ProjectPhotosSection;
