import React from "react";
import { Image, Button, Typography } from "antd";
import {
    CameraOutlined,
    ExpandOutlined,
    FolderOpenOutlined,
} from "@ant-design/icons";
import { Property, PropertyAsset } from "@/Types";
import { router } from "@inertiajs/react";

const { Text } = Typography;

interface PropertyGalleryProps {
    property: Property;
    canEdit?: boolean;
}

export default function PropertyGallery({
    property,
    canEdit = false,
}: PropertyGalleryProps) {
    const imageAssets =
        property.assets?.filter((a) => a.asset_type === "image") || [];
    const images = imageAssets
        .map((a) => a.url)
        .filter((url): url is string => !!url);

    const handleManageAssets = () => {
        router.visit(route("properties.assets.index", property.id));
    };

    if (images.length === 0) {
        return (
            <div className="relative rounded-xl bg-gray-50 border border-gray-200 h-80 flex items-center justify-center mb-6">
                <div className="text-center text-gray-400">
                    <CameraOutlined className="text-5xl mb-3" />
                    <p className="text-base">No photos yet</p>
                    {canEdit && (
                        <Button
                            type="primary"
                            size="small"
                            className="mt-3"
                            icon={<FolderOpenOutlined />}
                            onClick={handleManageAssets}
                        >
                            Upload Photos
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // Get first tag for an asset to show as label
    const getTag = (index: number) => {
        const asset = imageAssets[index];
        if (asset?.tags && asset.tags.length > 0) {
            return asset.tags[0]?.split("_").join(" ")?.split("-").join(" ");
        }
        return null;
    };

    const heroImage = images[0];
    const sideImages = images.slice(1, 5);
    const remainingCount = images.length - 5;

    return (
        <div className="relative mb-6">
            <Image.PreviewGroup items={images}>
                {/* Grid: 1 hero + up to 4 side images */}
                <div className="grid grid-cols-4 grid-rows-2 gap-1.5 rounded-xl overflow-hidden h-[420px]">
                    {/* Hero image — spans 2 cols + 2 rows */}
                    <div className="col-span-2 row-span-2 relative group cursor-pointer">
                        <Image
                            src={heroImage}
                            alt="Property photo"
                            className="object-cover w-full h-full"
                            style={{ height: "100%", width: "100%" }}
                            preview={{
                                mask: (
                                    <div className="flex items-center gap-2">
                                        <ExpandOutlined />
                                        <span>View</span>
                                    </div>
                                ),
                            }}
                        />
                        {getTag(0) && (
                            <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded capitalize">
                                {getTag(0)}
                            </span>
                        )}
                    </div>

                    {/* Side images — 4 slots */}
                    {sideImages.map((img, i) => (
                        <div key={i} className="relative group cursor-pointer">
                            <Image
                                src={img}
                                alt={`Property photo ${i + 2}`}
                                className="object-cover w-full h-full"
                                style={{ height: "100%", width: "100%" }}
                                preview={{
                                    mask: (
                                        <div className="flex items-center gap-2">
                                            <ExpandOutlined />
                                        </div>
                                    ),
                                }}
                            />
                            {getTag(i + 1) && (
                                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded capitalize">
                                    {getTag(i + 1)}
                                </span>
                            )}
                            {/* "+N more" overlay on last slot */}
                            {i === sideImages.length - 1 &&
                                remainingCount > 0 && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                        <Text className="text-white text-lg font-semibold">
                                            +{remainingCount} more
                                        </Text>
                                    </div>
                                )}
                        </div>
                    ))}

                    {/* Fill empty slots with gray placeholders if < 5 images */}
                    {Array.from({
                        length: Math.max(0, 4 - sideImages.length),
                    }).map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="bg-gray-100 flex items-center justify-center"
                        >
                            <CameraOutlined className="text-gray-300 text-xl" />
                        </div>
                    ))}
                </div>
            </Image.PreviewGroup>

            {/* Bottom overlay bar */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                    <CameraOutlined className="mr-1" />
                    {images.length} {images.length === 1 ? "photo" : "photos"}
                </span>
                {canEdit && (
                    <Button
                        size="small"
                        icon={<FolderOpenOutlined />}
                        onClick={handleManageAssets}
                        className="bg-white/90 hover:bg-white"
                    >
                        Manage
                    </Button>
                )}
            </div>
        </div>
    );
}
