import React, { useState, useCallback } from "react";
import { Card, Tag, Empty } from "antd";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { ImageItem } from "../Show";

interface ImageGallerySectionProps {
    title: string;
    images: ImageItem[];
}

const THUMBS_VISIBLE = 9;

const ImageGallerySection: React.FC<ImageGallerySectionProps> = ({ title, images }) => {
    const [activeIdx, setActiveIdx] = useState(0);
    const [thumbOffset, setThumbOffset] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [fade, setFade] = useState(true);

    const goTo = useCallback(
        (idx: number) => {
            const next = (idx + images.length) % images.length;
            setFade(false);
            setTimeout(() => {
                setActiveIdx(next);
                setFade(true);
                // Keep thumb strip centred on active
                if (next < thumbOffset) setThumbOffset(next);
                else if (next >= thumbOffset + THUMBS_VISIBLE) setThumbOffset(next - THUMBS_VISIBLE + 1);
            }, 120);
        },
        [images.length, thumbOffset],
    );

    const shiftThumbs = (dir: -1 | 1) => {
        setThumbOffset((o) =>
            Math.min(Math.max(0, o + dir * THUMBS_VISIBLE), Math.max(0, images.length - THUMBS_VISIBLE)),
        );
    };

    if (images.length === 0) {
        return (
            <Card title={title}>
                <Empty description={`No ${title.toLowerCase()} images found`} />
            </Card>
        );
    }

    const active = images[activeIdx];
    const visibleThumbs = images.slice(thumbOffset, thumbOffset + THUMBS_VISIBLE);
    const canShiftLeft = thumbOffset > 0;
    const canShiftRight = thumbOffset + THUMBS_VISIBLE < images.length;

    const viewer = (
        <div className="flex flex-col gap-3">
            {/* Main image */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                <img
                    key={activeIdx}
                    src={active.url}
                    alt={active.name}
                    className={`w-full h-full object-contain transition-opacity duration-200 object-cover ${fade ? "opacity-100" : "opacity-0"}`}
                />

                {/* Prev / Next */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={() => goTo(activeIdx - 1)}
                            className="absolute left-0 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white h-10 p-2 transition-colors shadow-lg cursor-pointer"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => goTo(activeIdx + 1)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white h-10 p-2 transition-colors shadow-lg cursor-pointer"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </>
                )}

                {/* Counter */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full select-none">
                    {activeIdx + 1} / {images.length}
                </div>

                {/* Source badge */}
                {active.source === "property" && (
                    <div className="absolute top-3 left-3">
                        <Tag color="blue">{active.property_title || `Property #${active.property_id}`}</Tag>
                    </div>
                )}

                {/* Fullscreen toggle */}
                <button
                    onClick={() => setFullscreen((f) => !f)}
                    className="cursor-pointer absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                >
                    {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>

            {/* Thumbnail filmstrip */}
            {images.length > 1 && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => shiftThumbs(-1)}
                        disabled={!canShiftLeft}
                        className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-1.5 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div className="flex gap-2 flex-1 overflow-hidden">
                        {visibleThumbs.map((img, i) => {
                            const realIdx = thumbOffset + i;
                            return (
                                <button
                                    key={`${img.source}-${img.id}`}
                                    onClick={() => goTo(realIdx)}
                                    className={`cursor-pointer flex-1 min-w-0 aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                                        realIdx === activeIdx
                                            ? "border-blue-600"
                                            : "border-transparent hover:border-gray-300"
                                    }`}
                                >
                                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => shiftThumbs(1)}
                        disabled={!canShiftRight}
                        className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-1.5 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <Card title={`${title} (${images.length})`}>{viewer}</Card>

            {/* Fullscreen overlay */}
            {fullscreen && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex flex-col gap-3 p-6"
                    onClick={(e) => e.target === e.currentTarget && setFullscreen(false)}
                >
                    <div className="flex-1 relative flex items-center justify-center">
                        <img
                            key={`fs-${activeIdx}`}
                            src={active.url}
                            alt={active.name}
                            className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${fade ? "opacity-100" : "opacity-0"}`}
                        />
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={() => goTo(activeIdx - 1)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={() => goTo(activeIdx + 1)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/20 text-white text-sm px-4 py-1 rounded-full select-none">
                            {activeIdx + 1} / {images.length}
                        </div>
                        <button
                            onClick={() => setFullscreen(false)}
                            className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                        >
                            <Minimize2 size={20} />
                        </button>
                    </div>

                    {/* Filmstrip in fullscreen */}
                    {images.length > 1 && (
                        <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
                            <button
                                onClick={() => shiftThumbs(-1)}
                                disabled={!canShiftLeft}
                                className="flex-shrink-0 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-1.5 text-white transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex gap-2 flex-1 overflow-hidden">
                                {visibleThumbs.map((img, i) => {
                                    const realIdx = thumbOffset + i;
                                    return (
                                        <button
                                            key={`fs-th-${img.source}-${img.id}`}
                                            onClick={() => goTo(realIdx)}
                                            className={`flex-1 min-w-0 aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                                                realIdx === activeIdx
                                                    ? "border-blue-500"
                                                    : "border-transparent hover:border-white/40"
                                            }`}
                                        >
                                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => shiftThumbs(1)}
                                disabled={!canShiftRight}
                                className="flex-shrink-0 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-1.5 text-white transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default ImageGallerySection;
