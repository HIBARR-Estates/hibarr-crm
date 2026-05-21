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
} from "antd";
import {
    UploadOutlined,
    CameraOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import useTranslation from "@/Hooks/useTranslation";
import type { UploadFile } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { AssetTag } from "@/Types";
import type { DeveloperProjectAsset } from "@/Types/developerProject";
import type { IUploadResponseItem } from "@/Types/uploads";
import { getFileUploadService } from "@/Services/FileUploadService";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { ApiSuccessResponse } from "@/lib/api/types";

const { Text, Title } = Typography;

// ────────────────────────────────────────────────────────────
// Asset Tag Keys (labels are translated via useTranslation)
// ────────────────────────────────────────────────────────────
const ASSET_TAG_KEYS: AssetTag[] = [
    "hero",
    "facilities",
    "features",
    "area",
    "exterior",
    "interior",
    "floor-plan",
    "site-plan",
    "footer",
    "gallery",
    "cover",
];

// ────────────────────────────────────────────────────────────
// Upload status tracking (mirrors ManageAssets / PhotosSection)
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
interface ConstructionProjectPhotosSectionProps {
    form: FormInstance;
    /** DeveloperProject ID — present in edit mode, absent on create */
    projectId?: number;
    /** Callback to trigger a "save & continue" flow so the project gets created first */
    onSaveForUpload?: () => void;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
const ConstructionProjectPhotosSection: React.FC<
    ConstructionProjectPhotosSectionProps
> = ({ form, projectId, onSaveForUpload }) => {
    const { t } = useTranslation();
    const { message: messageApi } = App.useApp();

    // Helper: get translated asset tag label
    const getAssetTagLabel = useCallback(
        (key: AssetTag): string => {
            return t(
                `pages.properties.construction_project_photos.asset_tags.${key}`,
            );
        },
        [t],
    );

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

    // Dynamically create TAG_OPTIONS with translated labels
    const TAG_OPTIONS = useMemo(
        () =>
            ASSET_TAG_KEYS.map((key) => ({
                value: key,
                label: getAssetTagLabel(key),
            })),
        [getAssetTagLabel],
    );

    // Translatable color mapping (kept as static since colors don't change by locale)
    const TAG_COLORS: Record<AssetTag, string> = useMemo(
        () => ({
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
        }),
        [],
    );

    // ─── Fetch existing assets ───
    const {
        data: assetsResponse,
        isLoading: isLoadingAssets,
        refetch: refetchAssets,
    } = useApiQuery<{ status: string; assets: DeveloperProjectAsset[] }>({
        path: projectId
            ? route("developer-projects.assets.index", projectId)
            : "",
        params: { asset_type: "image" },
        options: { enabled: !!projectId },
    });

    const imageAssets = useMemo(
        () => assetsResponse?.assets ?? [],
        [assetsResponse],
    );

    // Upload service — configured per project
    const uploadService = useMemo(() => {
        if (!projectId) return null;
        return getFileUploadService({
            defaultTargetFolder: `developer-projects/${projectId}/assets`,
            allowedTypes: [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
            ],
            maxFileSize: 200 * 1024 * 1024, // 200 MB
        });
    }, [projectId]);

    // Mutation: save uploaded file URLs to backend as DeveloperProjectAssets
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
            projectId
                ? route("developer-projects.assets.store_from_urls", projectId)
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

    // ─── Upload flow ───
    const handleUpload = useCallback(async () => {
        if (!uploadService || !projectId) return;

        const files: File[] = [];
        for (const f of uploadFileList) {
            if (f.originFileObj) {
                files.push(f.originFileObj as File);
            }
        }

        if (files.length === 0) {
            messageApi.warning(
                t(
                    "pages.properties.construction_project_photos.messages.please_select_photos",
                ),
            );
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

            // Save successful uploads to backend
            if (successfulUploads.length > 0) {
                const failedCount = files.length - successfulUploads.length;
                if (failedCount > 0) {
                    messageApi.warning(
                        t(
                            "pages.properties.construction_project_photos.messages.partial_upload_warning",
                            {
                                failed: failedCount,
                                success: successfulUploads.length,
                            },
                        ),
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
                messageApi.error(
                    t(
                        "pages.properties.construction_project_photos.messages.all_uploads_failed",
                    ),
                );
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
            if (!projectId) return;

            deleteModal.confirm({
                title: t(
                    "pages.properties.construction_project_photos.actions.delete_photo_title",
                ),
                content: t(
                    "pages.properties.construction_project_photos.messages.delete_confirmation",
                    {
                        name: asset.name,
                    },
                ),
                okText: t(
                    "pages.properties.construction_project_photos.actions.delete",
                ),
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
                            messageApi.success(
                                t(
                                    "pages.properties.construction_project_photos.messages.photo_deleted",
                                ),
                            );
                            refetchAssets();
                        })
                        .catch(() => {
                            messageApi.error(
                                t(
                                    "pages.properties.construction_project_photos.messages.failed_to_delete",
                                ),
                            );
                        });
                },
            });
        },
        [projectId, deleteModal, messageApi, refetchAssets],
    );

    // ─── Create mode: project not saved yet ───
    if (!projectId) {
        return (
            <div className="text-center py-8">
                <CameraOutlined
                    style={{ fontSize: 48, color: "#d9d9d9" }}
                    className="mb-4"
                />
                <Title level={5} type="secondary">
                    {t(
                        "pages.properties.construction_project_photos.labels.save_project_to_upload",
                    )}
                </Title>
                <Text type="secondary" className="block mb-4">
                    {t(
                        "pages.properties.construction_project_photos.labels.save_project_description",
                    )}
                </Text>
                {onSaveForUpload && (
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={onSaveForUpload}
                    >
                        {t(
                            "pages.properties.construction_project_photos.actions.save_and_continue",
                        )}
                    </Button>
                )}
            </div>
        );
    }

    // ─── Edit mode: full upload UI ───
    if (isLoadingAssets) {
        return (
            <div className="flex justify-center py-12">
                <Spin
                    tip={t(
                        "pages.properties.construction_project_photos.labels.loading_photos",
                    )}
                />
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
                        ? t(
                              "pages.properties.construction_project_photos.labels.photo_count",
                              { count: imageAssets.length },
                          )
                        : t(
                              "pages.properties.construction_project_photos.labels.no_photos_yet",
                          )}
                </Text>
                <Space>
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        {t(
                            "pages.properties.construction_project_photos.actions.upload_photos",
                        )}
                    </Button>
                </Space>
            </div>

            {/* Existing photos grid */}
            {imageAssets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {imageAssets.map((asset) => (
                        <div
                            key={asset.id}
                            className="relative group border border-gray-200 rounded-lg overflow-hidden"
                        >
                            <Image
                                src={asset.url || asset.external_url || ""}
                                alt={asset.name}
                                width="100%"
                                height={120}
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
                                            {getAssetTagLabel(tag)}
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
                    ))}
                </div>
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t(
                        "pages.properties.construction_project_photos.labels.no_photos_uploaded_yet",
                    )}
                    className="my-4"
                >
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        {t(
                            "pages.properties.construction_project_photos.actions.upload_first_photo",
                        )}
                    </Button>
                </Empty>
            )}

            {/* Upload Modal */}
            <Modal
                title={t(
                    "pages.properties.construction_project_photos.actions.upload_photos_modal_title",
                )}
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
                        {t(
                            "pages.properties.construction_project_photos.actions.cancel",
                        )}
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
                            ? t(
                                  "pages.properties.construction_project_photos.labels.uploading",
                              )
                            : isSavingToBackend
                              ? t(
                                    "pages.properties.construction_project_photos.labels.saving",
                                )
                              : t(
                                    "pages.properties.construction_project_photos.actions.upload_button",
                                    { count: uploadFileList.length || "" },
                                )}
                    </Button>,
                ]}
                maskClosable={!isUploading}
            >
                {/* Tag selector */}
                <div className="mb-4">
                    <Text className="text-sm block mb-1">
                        {t(
                            "pages.properties.construction_project_photos.labels.tags_optional",
                        )}
                    </Text>
                    <Select
                        mode="multiple"
                        placeholder={t(
                            "pages.properties.construction_project_photos.placeholders.select_tags_for_all_photos",
                        )}
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
                            {t(
                                "pages.properties.construction_project_photos.placeholders.click_or_drag_photos",
                            )}
                        </p>
                        <p className="ant-upload-hint text-xs">
                            {t(
                                "pages.properties.construction_project_photos.placeholders.supported_formats_and_size",
                            )}
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

export default ConstructionProjectPhotosSection;
