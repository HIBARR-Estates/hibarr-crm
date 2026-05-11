import React, { useCallback, useMemo, useState } from "react";
import {
    App,
    Button,
    Empty,
    Image,
    Modal,
    Progress,
    Space,
    Spin,
    Tag,
    Typography,
    Upload,
} from "antd";
import { PaperClipOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { getFacilityIconComponent } from "@/lib/facilityIcons";
import type { IUploadResponseItem } from "@/Types/uploads";
import type { DeveloperProjectAsset } from "@/Types/developerProject";
import { getFileUploadService } from "@/Services/FileUploadService";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "@/lib/api/types";

const { Text } = Typography;

const FACILITY_TAG_PREFIX = "facilities:";

interface FileUploadStatus {
    fileId: string;
    fileName: string;
    progress: number;
    status: "pending" | "uploading" | "success" | "error";
    error?: string;
}

interface FacilityImageItem {
    id: number;
    url: string;
    name: string;
}

export interface FacilityItem {
    name: string;
    label: string;
    icon: string | null;
}

interface FacilitiesSectionProps {
    projectId: number;
    facilities: FacilityItem[];
    facilityImagesBySlug?: Record<string, FacilityImageItem[]>;
}

// ── Component ─────────────────────────────────────────────────────────────
const FacilitiesSection: React.FC<FacilitiesSectionProps> = ({
    projectId,
    facilities,
    facilityImagesBySlug,
}) => {
    const { message: messageApi } = App.useApp();
    const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(
        null,
    );
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);

    const { data: assetsResponse, isLoading, refetch: refetchAssets } =
        useApiQuery<{ status: string; assets: DeveloperProjectAsset[] }>({
            path: route("developer-projects.assets.index", projectId),
            options: { enabled: !!projectId },
        });

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

    interface BulkUpdateTagsPayload {
        asset_ids: number[];
        tags: string[];
        action: "add" | "replace" | "remove";
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
                setSelectedFacility(null);
                refetchAssets();
                messageApi.success("Facility images uploaded");
            },
        );

    const { mutate: bulkUpdateTags, isPending: isBulkUpdating } = useApiMutate<
        BulkUpdateTagsPayload,
        { updated: number },
        ApiSuccessResponse<{ updated: number }>
    >(
        route("developer-projects.assets.bulk_update_tags", projectId),
        "PUT",
        () => {
            refetchAssets();
            messageApi.success("Image detached from facility");
        },
    );

    const parsedFacilityImages = useMemo(() => {
        const map: Record<string, FacilityImageItem[]> = {};

        for (const facility of facilities) {
            map[facility.name] = facilityImagesBySlug?.[facility.name]
                ? [...facilityImagesBySlug[facility.name]]
                : [];
        }

        const assets = assetsResponse?.assets ?? [];
        if (assets.length === 0) {
            return map;
        }

        for (const facility of facilities) {
            map[facility.name] = [];
        }

        for (const asset of assets) {
            if (asset.asset_type !== "image" || !asset.url) continue;

            const tags = (asset.tags ?? []) as string[];
            for (const tag of tags) {
                if (!tag.startsWith(FACILITY_TAG_PREFIX)) continue;

                const slug = tag.slice(FACILITY_TAG_PREFIX.length);
                if (!slug || !map[slug]) continue;

                if (!map[slug].some((item) => item.id === asset.id)) {
                    map[slug].push({
                        id: asset.id,
                        url: asset.url,
                        name: asset.name,
                    });
                }
            }
        }

        return map;
    }, [assetsResponse, facilities, facilityImagesBySlug]);

    const openUploadModal = useCallback((facility: FacilityItem) => {
        setSelectedFacility(facility);
        setUploadFileList([]);
        setUploadStatuses([]);
        setIsUploadModalOpen(true);
    }, []);

    const handleUpload = useCallback(async () => {
        if (!selectedFacility) return;

        const files: File[] = [];
        for (const f of uploadFileList) {
            if (f.originFileObj) {
                files.push(f.originFileObj as File);
            }
        }

        if (files.length === 0) {
            messageApi.warning("Please select images to upload");
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

                    const response = await uploadService.uploadSingle(
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

                    successfulUploads.push(response);
                    setUploadStatuses((prev) =>
                        prev.map((s) =>
                            s.fileId === fileId
                                ? { ...s, status: "success", progress: 100 }
                                : s,
                        ),
                    );
                } catch (error) {
                    setUploadStatuses((prev) =>
                        prev.map((s) =>
                            s.fileId === fileId
                                ? {
                                      ...s,
                                      status: "error",
                                      error:
                                          error instanceof Error
                                              ? error.message
                                              : "Upload failed",
                                  }
                                : s,
                        ),
                    );
                }
            }

            if (successfulUploads.length > 0) {
                saveAssetsToBackend({
                    assets: successfulUploads.map((u) => ({
                        url: encodeURI(u.downloadUrl),
                        name: u.originalName,
                        object_path: u.objectPath || null,
                        asset_type: "image",
                        mime_type: undefined,
                        file_size: undefined,
                    })),
                    tags: [
                        "facilities",
                        `${FACILITY_TAG_PREFIX}${selectedFacility.name}`,
                    ],
                });
            } else {
                messageApi.error("All uploads failed");
            }
        } finally {
            setIsUploading(false);
        }
    }, [
        selectedFacility,
        uploadFileList,
        messageApi,
        uploadService,
        projectId,
        saveAssetsToBackend,
    ]);

    const handleDetachFromFacility = useCallback(
        (assetId: number, facilitySlug: string) => {
            bulkUpdateTags({
                asset_ids: [assetId],
                tags: [`${FACILITY_TAG_PREFIX}${facilitySlug}`],
                action: "remove",
            });
        },
        [bulkUpdateTags],
    );

    if (facilities.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg flex items-center justify-center p-8">
                <Empty description="No facilities found" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-8 flex justify-center">
                <Spin />
            </div>
        );
    }

    return (
        <>
            <div className="mb-3">
                <Text type="secondary">
                    Attach one or many images to each facility. Images are mapped
                    with tags in format: <strong>facilities:&lt;slug&gt;</strong>.
                </Text>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {facilities.map((facility) => {
                    const IconComp = getFacilityIconComponent(facility.icon);
                    const images = parsedFacilityImages[facility.name] ?? [];

                    return (
                        <div
                            key={facility.name}
                            className="p-4 rounded-lg bg-white border border-gray-200"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-[#1a2a6c] flex-shrink-0">
                                        <IconComp size={20} />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-gray-800 leading-tight truncate">
                                            {facility.label}
                                        </div>
                                        <Tag className="mt-1" color="blue">
                                            {images.length} image
                                            {images.length === 1 ? "" : "s"}
                                        </Tag>
                                    </div>
                                </div>

                                <Button
                                    size="small"
                                    icon={<PaperClipOutlined />}
                                    onClick={() => openUploadModal(facility)}
                                >
                                    Attach image(s)
                                </Button>
                            </div>

                            {images.length === 0 ? (
                                <div className="mt-3 text-xs text-gray-500 border border-dashed border-gray-300 rounded-md p-3 text-center">
                                    No images attached yet
                                </div>
                            ) : (
                                <Image.PreviewGroup>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {images.slice(0, 3).map((img) => (
                                            <div
                                                key={img.id}
                                                className="relative rounded-md overflow-hidden border border-gray-200"
                                            >
                                                <Image
                                                    src={img.url}
                                                    alt={img.name}
                                                    width="100%"
                                                    height={84}
                                                    style={{ objectFit: "cover" }}
                                                />
                                                <button
                                                    type="button"
                                                    className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDetachFromFacility(
                                                            img.id,
                                                            facility.name,
                                                        );
                                                    }}
                                                    disabled={isBulkUpdating}
                                                >
                                                    Detach
                                                </button>
                                            </div>
                                        ))}
                                        {images.length > 3 && (
                                            <div className="h-[84px] rounded-md border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500 bg-gray-50">
                                                +{images.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </Image.PreviewGroup>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal
                title={
                    selectedFacility
                        ? `Attach Images - ${selectedFacility.label}`
                        : "Attach Images"
                }
                open={isUploadModalOpen}
                onCancel={() => {
                    if (isUploading || isSavingToBackend) return;
                    setIsUploadModalOpen(false);
                    setUploadFileList([]);
                    setUploadStatuses([]);
                    setSelectedFacility(null);
                }}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => {
                            setIsUploadModalOpen(false);
                            setUploadFileList([]);
                            setUploadStatuses([]);
                            setSelectedFacility(null);
                        }}
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
                    >
                        Upload
                    </Button>,
                ]}
                maskClosable={!(isUploading || isSavingToBackend)}
            >
                <Upload
                    listType="picture-card"
                    fileList={uploadFileList}
                    beforeUpload={() => false}
                    multiple
                    onChange={({ fileList }) => setUploadFileList(fileList)}
                >
                    <div>
                        <UploadOutlined />
                        <div style={{ marginTop: 8 }}>Select Files</div>
                    </div>
                </Upload>

                {uploadStatuses.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                        {uploadStatuses.map((status) => (
                            <div
                                key={status.fileId}
                                className="border border-gray-200 rounded-md p-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <Text ellipsis className="max-w-[280px]">
                                        {status.fileName}
                                    </Text>
                                    <Text
                                        type={
                                            status.status === "error"
                                                ? "danger"
                                                : "secondary"
                                        }
                                    >
                                        {status.status}
                                    </Text>
                                </div>
                                <Progress
                                    percent={status.progress}
                                    size="small"
                                    status={
                                        status.status === "error"
                                            ? "exception"
                                            : status.status === "success"
                                              ? "success"
                                              : "active"
                                    }
                                />
                                {status.error && (
                                    <Text type="danger" className="text-xs">
                                        {status.error}
                                    </Text>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-3">
                    <Space size={6} wrap>
                        <Tag color="blue">facilities</Tag>
                        {selectedFacility && (
                            <Tag color="geekblue">
                                {FACILITY_TAG_PREFIX}
                                {selectedFacility.name}
                            </Tag>
                        )}
                    </Space>
                </div>
            </Modal>
        </>
    );
};

export default FacilitiesSection;
