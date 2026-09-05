import { Tag } from "antd";
import { useState } from "react";
import { usePage } from "@inertiajs/react";
import {
    HomeOutlined,
    EnvironmentOutlined,
    DollarOutlined,
    LeftOutlined,
    RightOutlined,
} from "@ant-design/icons";
import { generatePropertySubtitle } from "@/lib/utils";

const PROPERTY_STATUS_COLORS: Record<string, string> = {
    available: "green",
    under_offer: "orange",
    sold: "red",
    rented: "blue",
};

const PER_PAGE = 3;

function PropertyCard({ product }: { product: any }) {
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
    const prop = product?.property ?? null;
    const photo = prop?.photos?.[0] ?? null;
    const statusColor = prop?.status
        ? (PROPERTY_STATUS_COLORS[
              prop.status.toLowerCase().replace(/ /g, "_")
          ] ?? "default")
        : "default";

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
            {/* Photo */}
            {photo ? (
                <img
                    src={photo}
                    alt={prop?.title ?? product.name}
                    className="w-full h-24 object-cover"
                />
            ) : (
                <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                    <HomeOutlined style={{ fontSize: 24, color: "#d1d5db" }} />
                </div>
            )}

            {/* Body */}
            <div className="px-2.5 py-2 space-y-1 flex-1">
                {/* Title + status */}
                <div className="flex flex-col items-start justify-between gap-1.5">
                    {prop ? (
                        <a
                            href={route("properties.show", { id: prop.id })}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 leading-snug line-clamp-2"
                        >
                            {generatePropertySubtitle(prop) ||
                                prop.title ||
                                product.name}
                        </a>
                    ) : (
                        <span className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">
                            {generatePropertySubtitle(product) || product.name}
                        </span>
                    )}
                    {prop?.status && (
                        <Tag
                            color={statusColor}
                            className="shrink-0 !text-[10px] !px-1 !py-0 capitalize leading-none"
                        >
                            {prop.status.replace(/_/g, " ")}
                        </Tag>
                    )}
                </div>

                {/* Type + sale type */}
                {prop?.property_type && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <HomeOutlined className="shrink-0" />
                        <span className="capitalize truncate">
                            {prop.property_type.replace(/_/g, " ")}
                            {prop.sale_type ? ` · ${prop.sale_type}` : ""}
                        </span>
                    </div>
                )}

                {/* Location */}
                {(prop?.city || prop?.area) && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <EnvironmentOutlined className="shrink-0" />
                        <span className="truncate">
                            {[prop.area, prop.city].filter(Boolean).join(", ")}
                        </span>
                    </div>
                )}

                {/* Price */}
                {prop?.price != null && Number(prop.price) > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                        <DollarOutlined className="shrink-0" />
                        <span>
                            {currencySymbol}
                            {new Intl.NumberFormat("en-US", {
                                maximumFractionDigits: 0,
                            }).format(Number(prop.price))}
                        </span>
                    </div>
                )}

                {/* Beds / Baths / Land */}
                {(prop?.bedrooms || prop?.bathrooms || prop?.land_size) && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        {prop.bedrooms && <span>{prop.bedrooms} Beds</span>}
                        {prop.bathrooms && <span>{prop.bathrooms} Baths</span>}
                        {prop.land_size && <span>{prop.land_size} m²</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PropertyCarousel({ products }: { products: any[] }) {
    const [pageIndex, setPageIndex] = useState(0);
    const total = products.length;
    const totalPages = Math.ceil(total / PER_PAGE);

    const prev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPageIndex((p) => (p - 1 + totalPages) % totalPages);
    };
    const next = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPageIndex((p) => (p + 1) % totalPages);
    };

    const visible = products.slice(
        pageIndex * PER_PAGE,
        (pageIndex + 1) * PER_PAGE,
    );

    return (
        <div className="w-full mt-0.5 space-y-2">
            {/* Navigation header — only when more than one page */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                        {pageIndex * PER_PAGE + 1}–
                        {Math.min((pageIndex + 1) * PER_PAGE, total)} of {total}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prev}
                            className="cursor-pointer bg-white hover:bg-gray-50 border border-gray-200 rounded-full w-5 h-5 flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-800 transition"
                            aria-label="Previous page"
                        >
                            <LeftOutlined style={{ fontSize: 9 }} />
                        </button>
                        <button
                            onClick={next}
                            className="cursor-pointer bg-white hover:bg-gray-50 border border-gray-200 rounded-full w-5 h-5 flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-800 transition"
                            aria-label="Next page"
                        >
                            <RightOutlined style={{ fontSize: 9 }} />
                        </button>
                    </div>
                </div>
            )}

            {/* Grid: 2 columns by default, 3 on wider containers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {visible.map((product) => (
                    <PropertyCard key={product.id} product={product} />
                ))}
            </div>

            {/* Dot indicators — one per page */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setPageIndex(i)}
                            className={`rounded-full transition-all ${
                                i === pageIndex
                                    ? "w-3 h-1.5 bg-blue-500"
                                    : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"
                            }`}
                            aria-label={`Page ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
