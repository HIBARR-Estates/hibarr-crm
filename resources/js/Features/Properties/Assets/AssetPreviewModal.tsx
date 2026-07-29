import React, { useState, useEffect } from "react";
import { router } from "@inertiajs/react";
import { PropertyAsset } from "@/Types";
import {
    Modal,
    Image,
    Tag,
    Typography,
    Space,
    Button,
    Divider,
    Select,
    message,
} from "antd";
import {
    LeftOutlined,
    RightOutlined,
    CloseOutlined,
    FileImageOutlined,
    VideoCameraOutlined,
    GlobalOutlined,
    DownloadOutlined,
    EditOutlined,
    SaveOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import { formatCompanyDateTime } from "@/lib/companyDateTime";

const { Title, Text, Paragraph } = Typography;

interface AssetPreviewModalProps {
    open: boolean;
    asset: PropertyAsset | null;
    allAssets: PropertyAsset[];
    propertyId?: number;
    availableTags?: Record<string, string>;
    onClose: () => void;
    onNavigate?: (asset: PropertyAsset) => void;
}

const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
    open,
    asset,
    allAssets,
    propertyId,
    availableTags = {},
    onClose,
    onNavigate,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [editedTags, setEditedTags] = useState<string[]>([]);

    useEffect(() => {
        if (asset && allAssets.length > 0) {
            const index = allAssets.findIndex((a) => a.id === asset.id);
            if (index !== -1) {
                setCurrentIndex(index);
            }
        }
    }, [asset, allAssets]);

    const currentAsset = allAssets[currentIndex] || asset;

    // Update edited tags when current asset changes
    useEffect(() => {
        if (currentAsset) {
            setEditedTags(currentAsset.tags || []);
            setIsEditingTags(false);
        }
    }, [currentAsset?.id]);

    // Mutation for updating tags
    const { mutate: updateTags, isPending: isUpdatingTags } = useApiMutate<
        { tags: string[] },
        any,
        ApiResponse<any>
    >(
        propertyId && currentAsset
            ? route("properties.assets.update", [propertyId, currentAsset.id])
            : "",
        "PUT",
        () => {
            message.success("Tags updated successfully");
            setIsEditingTags(false);
            router.reload({ only: ["assets"] });
        },
    );

    const handleSaveTags = () => {
        if (!propertyId || !currentAsset) return;
        updateTags({ tags: editedTags });
    };

    const handleCancelTagEdit = () => {
        setEditedTags(currentAsset?.tags || []);
        setIsEditingTags(false);
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            const newAsset = allAssets[currentIndex - 1];
            setCurrentIndex(currentIndex - 1);
            onNavigate?.(newAsset);
        }
    };

    const handleNext = () => {
        if (currentIndex < allAssets.length - 1) {
            const newAsset = allAssets[currentIndex + 1];
            setCurrentIndex(currentIndex + 1);
            onNavigate?.(newAsset);
        }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
        if (!open) return;

        if (e.key === "ArrowLeft") {
            handlePrevious();
        } else if (e.key === "ArrowRight") {
            handleNext();
        } else if (e.key === "Escape") {
            onClose();
        }
    };

    useEffect(() => {
        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [open, currentIndex]);

    if (!currentAsset) return null;

    const getAssetIcon = (assetType: PropertyAsset["asset_type"]) => {
        switch (assetType) {
            case "image":
                return <FileImageOutlined />;
            case "video":
            case "video_url":
                return <VideoCameraOutlined />;
            case "tour_360_url":
                return <GlobalOutlined />;
            default:
                return <FileImageOutlined />;
        }
    };

    const renderAssetPreview = () => {
        switch (currentAsset.asset_type) {
            case "image":
                return currentAsset.url ? (
                    <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
                        <Image
                            src={currentAsset.url}
                            alt={currentAsset.name}
                            preview={false}
                            className="max-h-[70vh] w-auto object-contain"
                            fallback="/img/placeholder.png"
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                        <FileImageOutlined className="text-6xl text-gray-300" />
                    </div>
                );

            case "video":
                return currentAsset.url ? (
                    <video
                        controls
                        className="w-full max-h-[70vh] rounded-lg"
                        src={currentAsset.url}
                    >
                        Your browser does not support the video tag.
                    </video>
                ) : null;

            case "video_url":
                return currentAsset.external_url ? (
                    <div className="aspect-video w-full rounded-lg overflow-hidden">
                        <iframe
                            src={currentAsset.external_url}
                            className="w-full h-full"
                            allowFullScreen
                            title={currentAsset.name}
                        />
                    </div>
                ) : null;

            case "tour_360_url":
                return currentAsset.external_url ? (
                    <div className="aspect-video w-full rounded-lg overflow-hidden">
                        <iframe
                            src={currentAsset.external_url}
                            className="w-full h-full"
                            allowFullScreen
                            title={currentAsset.name}
                        />
                    </div>
                ) : null;

            default:
                return (
                    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                        <Text className="text-gray-500">
                            Preview not available
                        </Text>
                    </div>
                );
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width="90%"
            style={{ maxWidth: 1200 }}
            footer={null}
            closeIcon={<CloseOutlined className="text-white" />}
            styles={{
                body: { padding: "24px" },
            }}
            className="asset-preview-modal"
        >
            <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <Title level={4} className="mb-2">
                            {currentAsset.name}
                        </Title>
                        <Space size="large">
                            <Space>
                                {getAssetIcon(currentAsset.asset_type)}
                                <Text className="text-gray-600 capitalize">
                                    {currentAsset.asset_type.replace("_", " ")}
                                </Text>
                            </Space>
                            {currentAsset.formatted_size && (
                                <Text className="text-gray-600">
                                    {currentAsset.formatted_size}
                                </Text>
                            )}
                            <Text className="text-gray-600">
                                {formatCompanyDateTime(currentAsset.created_at)}
                            </Text>
                        </Space>
                    </div>

                    {/* Navigation Counter */}
                    {allAssets.length > 1 && (
                        <Text className="text-gray-500">
                            {currentIndex + 1} / {allAssets.length}
                        </Text>
                    )}
                </div>

                {/* Preview Area */}
                <div className="relative min-h-[300px]">
                    {renderAssetPreview()}

                    {/* Navigation Buttons */}
                    {allAssets.length > 1 && (
                        <div className="mt-20 absolute left-0 top-1/2 w-full flex items-center">
                            <Button
                                type="primary"
                                shape="circle"
                                size="large"
                                icon={<LeftOutlined />}
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                                className="absolute left-4 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                            />
                            <Button
                                type="primary"
                                shape="circle"
                                size="large"
                                icon={<RightOutlined />}
                                onClick={handleNext}
                                disabled={currentIndex === allAssets.length - 1}
                                className="absolute left-12 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                            />
                        </div>
                    )}
                </div>

                <Divider className="my-2" />

                {/* Asset Details */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        {/* Tags */}
                        <div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Text strong>Tags:</Text>
                                {propertyId &&
                                    Object.keys(availableTags).length > 0 &&
                                    !isEditingTags && (
                                        <Button
                                            type="link"
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() =>
                                                setIsEditingTags(true)
                                            }
                                            className="p-0"
                                        >
                                            Edit
                                        </Button>
                                    )}
                            </div>
                            {isEditingTags ? (
                                <Space
                                    direction="vertical"
                                    className="w-full"
                                    size="small"
                                >
                                    <Select
                                        mode="multiple"
                                        style={{ width: "100%", maxWidth: 400 }}
                                        placeholder="Select tags"
                                        value={editedTags}
                                        onChange={setEditedTags}
                                        options={Object.entries(
                                            availableTags,
                                        ).map(([value, label]) => ({
                                            value,
                                            label,
                                        }))}
                                    />
                                    <Space>
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<SaveOutlined />}
                                            onClick={handleSaveTags}
                                            loading={isUpdatingTags}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            size="small"
                                            icon={<CloseCircleOutlined />}
                                            onClick={handleCancelTagEdit}
                                            disabled={isUpdatingTags}
                                        >
                                            Cancel
                                        </Button>
                                    </Space>
                                </Space>
                            ) : currentAsset.tags &&
                              currentAsset.tags.length > 0 ? (
                                <Space size={[8, 8]} wrap>
                                    {currentAsset.tags.map((tag) => (
                                        <Tag key={tag} color="blue">
                                            {availableTags[tag] || tag}
                                        </Tag>
                                    ))}
                                </Space>
                            ) : (
                                <Text type="secondary">No tags assigned</Text>
                            )}
                        </div>

                        {/* Metadata */}
                        {currentAsset.metadata &&
                            Object.keys(currentAsset.metadata).length > 0 && (
                                <div>
                                    <Text strong className="block mb-2">
                                        Details:
                                    </Text>
                                    <Space direction="vertical" size="small">
                                        {currentAsset.metadata.width &&
                                            currentAsset.metadata.height && (
                                                <Text className="text-gray-600">
                                                    Dimensions:{" "}
                                                    {
                                                        currentAsset.metadata
                                                            .width
                                                    }{" "}
                                                    x{" "}
                                                    {
                                                        currentAsset.metadata
                                                            .height
                                                    }{" "}
                                                    px
                                                </Text>
                                            )}
                                        {currentAsset.metadata
                                            .original_name && (
                                            <Text className="text-gray-600">
                                                Original:{" "}
                                                {
                                                    currentAsset.metadata
                                                        .original_name
                                                }
                                            </Text>
                                        )}
                                    </Space>
                                </div>
                            )}
                    </div>

                    {/* Actions */}
                    <Space>
                        {(currentAsset.url || currentAsset.external_url) && (
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                href={
                                    currentAsset.url ||
                                    currentAsset.external_url
                                }
                                target="_blank"
                                download={currentAsset.name}
                            >
                                Download
                            </Button>
                        )}
                    </Space>
                </div>
            </div>
        </Modal>
    );
};

export default AssetPreviewModal;
