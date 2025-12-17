import React from "react";
import { PropertyAsset } from "@/Types";
import { Card, Checkbox, Image, Tag, Typography, Tooltip, Empty } from "antd";
import {
    FileImageOutlined,
    VideoCameraOutlined,
    GlobalOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text, Paragraph } = Typography;

interface AssetGridViewProps {
    assets: PropertyAsset[];
    selectedAssets: number[];
    onAssetClick: (asset: PropertyAsset) => void;
    onAssetSelect: (assetId: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
}

const AssetGridView: React.FC<AssetGridViewProps> = ({
    assets,
    selectedAssets,
    onAssetClick,
    onAssetSelect,
}) => {
    const getAssetIcon = (assetType: PropertyAsset["asset_type"]) => {
        switch (assetType) {
            case "image":
                return <FileImageOutlined className="text-blue-500" />;
            case "video":
            case "video_url":
                return <VideoCameraOutlined className="text-red-500" />;
            case "tour_360_url":
                return <GlobalOutlined className="text-green-500" />;
            default:
                return <FileImageOutlined />;
        }
    };

    if (assets.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <Empty description="No assets found."  />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {assets.map((asset) => {
                const isSelected = selectedAssets.includes(asset.id);

                return (
                    <Card
                        key={asset.id}
                        hoverable
                        className={`overflow-hidden transition-all ${
                            isSelected
                                ? "ring-2 ring-blue-500 shadow-lg"
                                : "hover:shadow-md"
                        }`}
                        bodyStyle={{ padding: 0 }}
                    >
                        {/* Selection Checkbox */}
                        <div className="absolute top-2 left-2 z-10">
                            <Checkbox
                                checked={isSelected}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onAssetSelect(asset.id, e.target.checked);
                                }}
                                className="bg-white/90 backdrop-blur-sm rounded p-1"
                            />
                        </div>

                        {/* Asset Type Badge */}
                        <div className="absolute top-2 right-2 z-10">
                            <Tooltip title={asset.asset_type}>
                                <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                                    {getAssetIcon(asset.asset_type)}
                                </div>
                            </Tooltip>
                        </div>

                        {/* Asset Preview */}
                        <div
                            className="relative w-full aspect-square cursor-pointer bg-gray-100"
                            onClick={() => onAssetClick(asset)}
                        >
                            {asset.asset_type === "image" ? (
                                asset.url ? (
                                    <Image
                                        src={asset.url}
                                        alt={asset.name}
                                        preview={false}
                                        className="w-full h-full object-cover"
                                        fallback="/img/placeholder.png"
                                        onError={(e) => {
                                            console.error('Image load error:', asset.url, asset);
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                        <FileImageOutlined className="text-6xl text-gray-400" />
                                        <div className="absolute bottom-2 text-xs text-gray-500">
                                            No URL
                                        </div>
                                    </div>
                                )
                            ) : asset.asset_type === "video" ||
                              asset.asset_type === "video_url" ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                    <VideoCameraOutlined className="text-6xl text-gray-400" />
                                </div>
                            ) : asset.asset_type === "tour_360_url" ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                    <GlobalOutlined className="text-6xl text-gray-400" />
                                </div>
                            ) : null}
                        </div>

                        {/* Asset Info */}
                        <div className="p-2">
                            <Tooltip title={asset.name}>
                                <Paragraph
                                    ellipsis={{ rows: 1 }}
                                    className="text-sm font-medium mb-1"
                                >
                                    {asset.name}
                                </Paragraph>
                            </Tooltip>

                            {/* Tags */}
                            {asset.tags && asset.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {asset.tags.slice(0, 2).map((tag) => (
                                        <Tag
                                            key={tag}
                                            className="text-xs"
                                            color="blue"
                                        >
                                            {tag}
                                        </Tag>
                                    ))}
                                    {asset.tags.length > 2 && (
                                        <Tag className="text-xs" color="default">
                                            +{asset.tags.length - 2}
                                        </Tag>
                                    )}
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <Text className="text-xs text-gray-500">
                                    {asset.formatted_size || "N/A"}
                                </Text>
                                <Text className="text-xs text-gray-400">
                                    {dayjs(asset.created_at).format("MMM D")}
                                </Text>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

export default AssetGridView;
