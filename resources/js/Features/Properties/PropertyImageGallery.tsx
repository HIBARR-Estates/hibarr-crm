import React, { useState } from "react";
import { Image, Carousel } from "antd";
import { EyeOutlined, CameraOutlined } from "@ant-design/icons";

interface PropertyImageGalleryProps {
    images: string[];
    title?: string;
}

export default function PropertyImageGallery({
    images,
    title = "Property Images",
}: PropertyImageGalleryProps) {
    // Filter out any null/undefined URLs
    const validImages = images.filter(img => img && img.trim() !== '');
    
    if (!validImages || validImages.length === 0) {
        return (
            <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <CameraOutlined className="text-4xl mb-2" />
                    <p>No images available</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="relative rounded-lg overflow-hidden">
                <Carousel
                    autoplay
                    dots={{ className: "custom-carousel-dots" }}
                    effect="fade"
                >
                    {validImages.map((image, index) => (
                        <div key={index} className="relative">
                            <div
                                className="h-96 bg-cover bg-center cursor-pointer"
                                style={{ backgroundImage: `url(${image})` }}
                            >
                                <div className="absolute inset-0 bg-black/5 bg-opacity-0 hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                                    <div className="opacity-0 hover:opacity-100 transition-opacity">
                                        <EyeOutlined className="text-white text-3xl" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </Carousel>

                {/* Image counter overlay */}
                <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-full text-sm">
                    <CameraOutlined className="mr-1" />
                    {validImages.length} {validImages.length === 1 ? "Photo" : "Photos"}
                </div>

                {/* Thumbnail navigation */}
                {validImages.length > 1 && (
                    <div className="absolute bottom-4 left-4 flex gap-2">
                        {validImages.slice(0, 5).map((image, index) => (
                            <div key={index}>
                                <Image
                                    src={image}
                                    alt={`Thumbnail ${index + 1}`}
                                    width={80}
                                    height={60}
                                    className="object-cover rounded cursor-pointer border-2  border-gray-200 hover:border-white transition-colors"
                                />
                            </div>
                        ))}
                        {validImages.length > 5 && (
                            <div className="w-12 h-12 rounded border-2 border-white bg-black bg-opacity-70 flex items-center justify-center cursor-pointer text-white text-xs">
                                +{validImages.length - 5}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
