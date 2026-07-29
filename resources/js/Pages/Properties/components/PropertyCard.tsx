import { Link, router } from "@inertiajs/react";
import { Dropdown, Popconfirm, Tag } from "antd";
import {
    Eye,
    Pencil,
    Trash2,
    MoreHorizontal,
    MapPin,
    BedDouble,
    Bath,
    Maximize2,
    Calendar,
} from "lucide-react";
import type { MenuProps } from "antd";
import type { Property } from "@/Types";
import { generatePropertySubtitle } from "@/lib/utils";
import { formatCompanyDate } from "@/lib/companyDateTime";

interface PropertyCardProps {
    property: Property;
    currencyCode?: string;
    currencySymbol?: string;
    onEdit?: (property: Property) => void;
    onDelete?: (property: Property) => void;
}

type PropertyPhotoValue =
    | string
    | {
          url?: string;
          file_url?: string;
          original_url?: string;
          path?: string;
          file_path?: string;
      }
    | null
    | undefined;

function resolveImageSrc(photo: PropertyPhotoValue): string | null {
    if (!photo) return null;

    const rawSrc =
        typeof photo === "string"
            ? photo
            : (photo.url ??
              photo.file_url ??
              photo.original_url ??
              photo.path ??
              photo.file_path ??
              null);

    if (!rawSrc || typeof rawSrc !== "string") return null;

    const src = rawSrc.trim();
    if (!src) return null;

    if (/^(https?:|data:|blob:|\/\/)/i.test(src) || src.startsWith("/")) {
        return src;
    }

    return `/${src.replace(/^\.\/?/, "")}`;
}

function formatPrice(
    price: number | string | null | undefined,
    currencyCode?: string,
    currencySymbol?: string,
): string {
    if (!price) return "Price on request";
    const num = typeof price === "string" ? parseFloat(price) : price;
    if (!Number.isFinite(num) || num === 0) return "Price on request";

    if (currencyCode) {
        try {
            return new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: currencyCode,
                maximumFractionDigits: 0,
            }).format(num);
        } catch {
            // Fall back to the configured symbol below.
        }
    }

    const formatted = num.toLocaleString("en-GB", {
        maximumFractionDigits: 0,
    });

    return currencySymbol ? `${currencySymbol}${formatted}` : formatted;
}

const SALE_TYPE_LABEL: Record<string, string> = {
    sale: "For Sale",
    rent: "For Rent",
};

const PropertyCard: React.FC<PropertyCardProps> = ({
    property,
    currencyCode,
    currencySymbol,
    onEdit,
    onDelete,
}) => {
    const firstPhoto =
        property.assets?.[0]?.url ??
        resolveImageSrc(property.photos?.[0] as PropertyPhotoValue) ??
        null;

    const menuItems: MenuProps["items"] = [
        {
            key: "view",
            label: (
                <Link
                    href={route("properties.show", property.id)}
                    className="flex items-center gap-2"
                >
                    <Eye size={13} />
                    View
                </Link>
            ),
        },
        {
            key: "edit",
            label: (
                <span
                    className="flex items-center gap-2"
                    onClick={() => onEdit?.(property)}
                >
                    <Pencil size={13} />
                    Edit
                </span>
            ),
        },
        { type: "divider" },
        {
            key: "delete",
            label: (
                <Popconfirm
                    title="Delete Property"
                    description="Are you sure you want to delete this property?"
                    onConfirm={() => onDelete?.(property)}
                    okText="Delete"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                >
                    <span className="flex items-center gap-2 text-red-500">
                        <Trash2 size={13} />
                        Delete
                    </span>
                </Popconfirm>
            ),
        },
    ];

    const saleTypeLabel =
        SALE_TYPE_LABEL[property.sale_type] ?? property.sale_type;

    return (
        <div
            onClick={() => router.visit(route("properties.show", property.id))}
            className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
            {/* ── Hero image ── */}
            <div className="relative h-44 overflow-hidden flex items-center justify-center bg-gray-50">
                {/* Context menu */}
                <div
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Dropdown
                        menu={{ items: menuItems }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <button className="w-7 h-7 flex items-center justify-center bg-white/90 rounded-md shadow text-gray-600 hover:bg-white transition-colors cursor-pointer">
                            <MoreHorizontal size={16} />
                        </button>
                    </Dropdown>
                </div>

                {firstPhoto ? (
                    <img
                        src={firstPhoto}
                        alt={
                            generatePropertySubtitle(property) ||
                            "Property Photo"
                        }
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-[#001529] flex items-center justify-center px-4">
                        <span className="text-white/60 text-sm font-semibold text-center leading-snug select-none">
                            {generatePropertySubtitle(property)}
                        </span>
                    </div>
                )}

                {/* Sale/Rent badge */}
                <div className="absolute top-2.5 left-2.5 bg-black/60 rounded px-2 py-1">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wide">
                        {saleTypeLabel}
                    </span>
                </div>

                {/* Published indicator */}
                {property.is_published && (
                    <div
                        className="absolute bottom-2 right-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Tag color="green" className="!m-0 !text-[10px]">
                            Published
                        </Tag>
                    </div>
                )}
            </div>

            {/* ── Card body ── */}
            <div className="px-4 pt-3 pb-4">
                <p className="font-bold text-sm text-slate-900 truncate mb-0.5">
                    {generatePropertySubtitle(property) || property.title}
                </p>

                <p className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <MapPin size={11} className="text-gray-300 shrink-0" />
                    {[property.area, property.city]
                        .filter(Boolean)
                        .join(", ") || "No location"}
                </p>

                {/* Stats row */}
                <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                        {property.bedrooms != null && (
                            <span className="flex items-center gap-1">
                                <BedDouble
                                    size={12}
                                    className="text-gray-400"
                                />
                                {property.bedrooms}
                            </span>
                        )}
                        {property.bathrooms != null && (
                            <span className="flex items-center gap-1">
                                <Bath size={12} className="text-gray-400" />
                                {property.bathrooms}
                            </span>
                        )}
                        {property.land_size != null && (
                            <span className="flex items-center gap-1">
                                <Maximize2
                                    size={12}
                                    className="text-gray-400"
                                />
                                {property.land_size} m²
                            </span>
                        )}
                    </div>
                    {property.created_at && (
                        <span className="flex items-center gap-1 text-gray-400">
                            <Calendar size={11} />
                            {formatCompanyDate(property.created_at)}
                        </span>
                    )}
                </div>

                {/* Price + type */}
                <div className="flex items-end justify-between border-t border-gray-100 pt-2.5">
                    <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">
                            Price
                        </p>
                        <p className="font-bold text-sm text-slate-900">
                            {formatPrice(
                                property.price,
                                currencyCode,
                                currencySymbol,
                            )}
                        </p>
                    </div>
                    {property.property_type && (
                        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 capitalize">
                            {typeof property.property_type === "string"
                                ? property.property_type
                                : ((property.property_type as any)?.name ?? "")}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropertyCard;
