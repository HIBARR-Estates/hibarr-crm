import React, { useState } from "react";
import { Modal, Image, Carousel, Button } from "antd";
import {
    EyeOutlined,
    CameraOutlined,
    LeftOutlined,
    RightOutlined,
} from "@ant-design/icons";

interface PropertyImageGalleryProps {
    images: string[];
    title?: string;
}

export default function PropertyImageGallery({
    images,
    title = "Property Images",
}: PropertyImageGalleryProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const carouselRef = React.useRef<any>(null);

    if (!images || images.length === 0) {
        return (
            <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <CameraOutlined className="text-4xl mb-2" />
                    <p>No images available</p>
                </div>
            </div>
        );
    }

    const handleImageClick = (index: number) => {
        setCurrentIndex(index);
        setModalVisible(true);
    };

    const handlePrevious = () => {
        const newIndex =
            currentIndex > 0 ? currentIndex - 1 : images.length - 1;
        setCurrentIndex(newIndex);
        carouselRef.current?.goTo(newIndex);
    };

    const handleNext = () => {
        const newIndex =
            currentIndex < images.length - 1 ? currentIndex + 1 : 0;
        setCurrentIndex(newIndex);
        carouselRef.current?.goTo(newIndex);
    };

    return (
        <>
            <div className="relative rounded-lg overflow-hidden">
                <Carousel
                    autoplay
                    dots={{ className: "custom-carousel-dots" }}
                    effect="fade"
                >
                    {images.map((image, index) => (
                        <div key={index} className="relative">
                            <div
                                className="h-96 bg-cover bg-center cursor-pointer"
                                style={{ backgroundImage: `url(${image})` }}
                                onClick={() => handleImageClick(index)}
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
                    {images.length} {images.length === 1 ? "Photo" : "Photos"}
                </div>

                {/* Thumbnail navigation */}
                {images.length > 1 && (
                    <div className="absolute bottom-4 left-4 flex gap-2">
                        {images.slice(0, 5).map((image, index) => (
                            <div
                                key={index}
                                className="w-12 h-12 rounded border-2 border-white cursor-pointer overflow-hidden"
                                onClick={() => handleImageClick(index)}
                            >
                                <img
                                    src={image}
                                    alt={`Thumbnail ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                        {images.length > 5 && (
                            <div
                                className="w-12 h-12 rounded border-2 border-white bg-black bg-opacity-70 flex items-center justify-center cursor-pointer text-white text-xs"
                                onClick={() => handleImageClick(5)}
                            >
                                +{images.length - 5}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full-screen image modal */}
            <Modal
                open={modalVisible}
                footer={null}
                onCancel={() => setModalVisible(false)}
                width="95%"
                style={{ top: 20, maxWidth: 1200 }}
                className="property-image-modal"
            >
                <div className="relative">
                    <Carousel
                        ref={carouselRef}
                        initialSlide={currentIndex}
                        beforeChange={(current, next) => setCurrentIndex(next)}
                        dots={false}
                    >
                        {images.map((image, index) => (
                            <div key={index}>
                                <Image
                                    src={image}
                                    alt={`${title} ${index + 1}`}
                                    className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                                />
                            </div>
                        ))}
                    </Carousel>

                    {/* Navigation buttons */}
                    {images.length > 1 && (
                        <>
                            <Button
                                type="primary"
                                shape="circle"
                                icon={<LeftOutlined />}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10"
                                onClick={handlePrevious}
                            />
                            <Button
                                type="primary"
                                shape="circle"
                                icon={<RightOutlined />}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10"
                                onClick={handleNext}
                            />
                        </>
                    )}

                    {/* Image counter */}
                    <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                        {currentIndex + 1} / {images.length}
                    </div>

                    {/* Thumbnail strip */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black bg-opacity-70 p-2 rounded-lg max-w-full overflow-x-auto">
                        {images.map((image, index) => (
                            <div
                                key={index}
                                className={`w-12 h-12 rounded cursor-pointer overflow-hidden border-2 ${
                                    index === currentIndex
                                        ? "border-blue-500"
                                        : "border-transparent"
                                }`}
                                onClick={() => {
                                    setCurrentIndex(index);
                                    carouselRef.current?.goTo(index);
                                }}
                            >
                                <img
                                    src={image}
                                    alt={`Thumbnail ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </>
    );
}
