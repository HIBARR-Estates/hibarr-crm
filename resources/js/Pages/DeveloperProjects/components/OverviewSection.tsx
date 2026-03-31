import React, { useState, useMemo } from "react";
import { Card, Table, Tag, Empty } from "antd";
// Tag kept for property-type table column render
import type { TableColumnsType } from "antd";
import { Building2, CheckCircle2, Clock, TrendingDown, MapPin } from "lucide-react";
import type { ShowProps, PropertyTypeSummary, Statistics, ImageItem } from "../Show";

// ── Stat Card ─────────────────────────────────────────────────────────────
const StatCard: React.FC<{ icon: React.ReactNode; value: string | number; label: string }> = ({
    icon,
    value,
    label,
}) => (
    <div className="flex-1 min-w-[140px] flex flex-col items-center gap-2.5 bg-white border border-gray-200 rounded-xl p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-[#1a2a6c] flex items-center justify-center text-white flex-shrink-0">
            {icon}
        </div>
        <div>
            <div className="text-[15px] font-bold text-slate-900 leading-tight">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
    </div>
);

// ── Props ─────────────────────────────────────────────────────────────────
interface OverviewSectionProps {
    project: ShowProps["project"];
    statistics: Statistics;
    propertyTypesSummary: PropertyTypeSummary[];
    imagesByTag?: Record<string, ImageItem[]>;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
    project,
    statistics,
    propertyTypesSummary,
    imagesByTag,
}) => {
    const [imgError, setImgError] = useState(false);

    // Pick the first available project-source image, then any image
    const heroImage = useMemo(() => {
        if (!imagesByTag) return null;
        for (const images of Object.values(imagesByTag)) {
            const src = images.find((img) => img.source === "project");
            if (src) return src.url;
        }
        for (const images of Object.values(imagesByTag)) {
            if (images.length > 0) return images[0].url;
        }
        return null;
    }, [imagesByTag]);

    const formatPrice = (price: number | null) => {
        if (!price) return "-";
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
        }).format(price);
    };

    const formatRange = (min: number | null, max: number | null) => {
        if (min === null && max === null) return "-";
        if (min === max || max === null) return `${min}`;
        if (min === null) return `${max}`;
        return `${min} - ${max}`;
    };

    const columns: TableColumnsType<PropertyTypeSummary> = [
        {
            title: "Property Type",
            dataIndex: "type",
            key: "type",
            render: (type: string) => <Tag color="blue">{type}</Tag>,
        },
        {
            title: "Count",
            dataIndex: "count",
            key: "count",
            align: "center",
        },
        {
            title: "Bedrooms",
            key: "bedrooms",
            align: "center",
            render: (_, record) => formatRange(record.bedrooms.min, record.bedrooms.max),
        },
        {
            title: "Bathrooms",
            key: "bathrooms",
            align: "center",
            render: (_, record) => formatRange(record.bathrooms.min, record.bathrooms.max),
        },
        {
            title: "Area (m²)",
            key: "area",
            align: "center",
            render: (_, record) => formatRange(record.area.min, record.area.max),
        },
        {
            title: "Price",
            key: "price",
            render: (_, record) => {
                if (!record.price.min) return "-";
                if (record.price.min === record.price.max) return formatPrice(record.price.min);
                return `From ${formatPrice(record.price.min)}`;
            },
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* ── Main card ────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="flex flex-col gap-2 mb-4">
                    <h1 className="text-[28px] font-bold text-slate-900 leading-tight">
                        {project.name}
                    </h1>
                    {project.location?.name && (
                        <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-7">
                            <MapPin size={14} className="text-gray-400" />
                            {project.location.name}
                        </p>
                    )}
                </div>

                {/* Stat Cards */}
                <div className="flex flex-wrap gap-3 mb-9">
                    <StatCard icon={<Building2 size={22} />} value={statistics.total_properties} label="Total Properties" />
                    <StatCard icon={<CheckCircle2 size={22} />} value={statistics.available_properties} label="Available" />
                    <StatCard icon={<Clock size={22} />} value={statistics.under_offer_properties} label="Under Offer" />
                    <StatCard icon={<TrendingDown size={22} />} value={`${statistics.sold_percentage}%`} label="Sold" />
                </div>

                {/* Description with floated hero image */}
                <div className="clearfix">
                    {/* Hero image — floated right so text wraps around and under */}
                    {heroImage && !imgError ? (
                        <div className="mb-4 rounded-xl overflow-hidden shadow-lg w-full min-h-52 md:float-right md:ml-6 md:w-2/5">
                            <img
                                src={heroImage}
                                alt={project.name}
                                onError={() => setImgError(true)}
                                className="w-full h-full object-cover block min-h-52"
                            />
                        </div>
                    ) : null}

                    {project.description ? (
                        <p className="text-sm leading-7 text-gray-600">{project.description}</p>
                    ) : null}

                    <div className="clear-both" />
                </div>
            </div>

            {/* ── Property Types Table ──────────────────────────────── */}
            <Card title="Property Types">
                {propertyTypesSummary.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={propertyTypesSummary}
                        rowKey="type"
                        pagination={false}
                        size="small"
                    />
                ) : (
                    <Empty description="No properties assigned to this project" />
                )}
            </Card>
        </div>
    );
};

export default OverviewSection;
