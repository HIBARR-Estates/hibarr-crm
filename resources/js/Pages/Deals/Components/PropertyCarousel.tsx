import { Tag } from "antd";
import { useState } from "react";
import {
    HomeOutlined,
    EnvironmentOutlined,
    DollarOutlined,
    LeftOutlined,
    RightOutlined,
}  from "@ant-design/icons";

const PROPERTY_STATUS_COLORS: Record<string, string> = {
    available: "green",
    under_offer: "orange",
    sold: "red",
    rented: "blue",
};


export default function PropertyCarousel({ products }: { products: any[] }) {
    const [index, setIndex] = useState(0);
    const total = products.length;

    const prev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIndex((i) => (i - 1 + total) % total);
    };
    const next = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIndex((i) => (i + 1) % total);
    };

    const product = products[index];
    const prop = product?.property ?? null;
    const photo = prop?.photos?.[0] ?? null;
    const statusColor = prop?.status
        ? (PROPERTY_STATUS_COLORS[prop.status.toLowerCase().replace(/ /g, "_")] ?? "default")
        : "default";

    return (
        <div className="w-full mt-0.5">
            {/* Card */}
            <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {/* Photo */}
                {photo ? (
                    <img
                        src={photo}
                        alt={prop?.title ?? product.name}
                        className="w-full h-32 object-cover"
                    />
                ) : (
                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                        <HomeOutlined style={{ fontSize: 32, color: "#d1d5db" }} />
                    </div>
                )}

                {/* Prev / Next arrows — only when more than 1 property */}
                {total > 1 && (
                    <>
                        <button
                            onClick={prev}
                            className="cursor-pointer absolute left-1.5 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-gray-600 hover:text-gray-900 transition"
                            aria-label="Previous property"
                        >
                            <LeftOutlined style={{ fontSize: 10 }} />
                        </button>
                        <button
                            onClick={next}
                            className="cursor-pointer absolute right-1.5 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-gray-600 hover:text-gray-900 transition"
                            aria-label="Next property"
                        >
                            <RightOutlined style={{ fontSize: 10 }} />
                        </button>
                    </>
                )}

                {/* Body */}
                <div className="px-3 py-2 space-y-1.5">
                    {/* Title + status */}
                    <div className="flex items-start justify-between gap-2">
                        {prop ? (
                            <a
                                href={route("properties.show", { id: prop.id })}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 leading-snug"
                            >
                                {prop.title ?? product.name}
                            </a>
                            
                            
                        ) : (
                            <span className="text-sm font-semibold text-gray-800">{product.name}</span>
                        )}
                        {prop?.status && (
                            <Tag color={statusColor} className="shrink-0 text-xs capitalize">
                                {prop.status.replace(/_/g, " ")}
                            </Tag>
                        )}
                    </div>

                    {/* Type + sale type */}
                    {prop?.property_type && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <HomeOutlined />
                            <span className="capitalize">
                                {prop.property_type.replace(/_/g, " ")}
                                {prop.sale_type ? ` · ${prop.sale_type}` : ""}
                            </span>
                        </div>
                    )}

                    {/* Location */}
                    {(prop?.city || prop?.area) && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <EnvironmentOutlined />
                            <span>{[prop.area, prop.city].filter(Boolean).join(", ")}</span>
                        </div>
                    )}

                    {/* Price */}
                    {prop?.price != null && Number(prop.price) > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                            <DollarOutlined />
                            <span>
                                {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                }).format(Number(prop.price))}
                            </span>
                        </div>
                    )}

                    {/* Beds / Baths / Land */}
                    {(prop?.bedrooms || prop?.bathrooms || prop?.land_size) && (
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            {prop.bedrooms && <span>{prop.bedrooms} Beds</span>}
                            {prop.bathrooms && <span>{prop.bathrooms} Baths</span>}
                            {prop.land_size && <span>{prop.land_size} m²</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Dot indicators */}
            {total > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                    {products.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndex(i)}
                            className={`rounded-full transition-all ${i === index
                                    ? "w-3 h-1.5 bg-blue-500"
                                    : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"
                                }`}
                            aria-label={`Property ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}