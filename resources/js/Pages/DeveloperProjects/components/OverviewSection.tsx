import React, { useState, useMemo } from "react";
import { Card, Table, Empty } from "antd";
import type { TableColumnsType } from "antd";
import {
    Building2,
    CheckCircle2,
    Clock,
    MapPin,
    TrendingUp,
} from "lucide-react";
import type {
    ShowProps,
    UnitTypeSummary,
    Statistics,
    ImageItem,
} from "../Show";
import { generatePropertySubtitle, snakeToReadable } from "../../../lib/utils";

// ── Stat Card ─────────────────────────────────────────────────────────────
const StatCard: React.FC<{
    icon: React.ReactNode;
    value: string | number;
    label: string;
}> = ({ icon, value, label }) => (
    <div className="flex-1 min-w-[140px] flex flex-col items-center gap-2.5 bg-white border border-gray-200 rounded-xl p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-[#1a2a6c] flex items-center justify-center text-white flex-shrink-0">
            {icon}
        </div>
        <div>
            <div className="text-[15px] font-bold text-slate-900 leading-tight">
                {value}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
    </div>
);

// ── Props ─────────────────────────────────────────────────────────────────
interface OverviewSectionProps {
    project: ShowProps["project"];
    statistics: Statistics;
    unitTypesSummary: UnitTypeSummary[];
    imagesByTag?: Record<string, ImageItem[]>;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
    project,
    statistics,
    unitTypesSummary,
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

    const columns: TableColumnsType<UnitTypeSummary> = [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (_, record) => (
                <span className="text-gray-800">
                    {generatePropertySubtitle(record)}
                </span>
            ),
        },
        {
            title: "Property Type",
            dataIndex: "type",
            key: "type",
            render: (type: string) => (
                <span className="text-gray-800">{snakeToReadable(type)}</span>
            ),
        },
        {
            title: "Quantity",
            dataIndex: "quantity",
            key: "quantity",
            align: "center",
        },
        {
            title: "Bedrooms",
            key: "bedrooms",
            align: "center",
            render: (_, record) =>
                formatRange(record.bedrooms.min, record.bedrooms.max),
        },
        {
            title: "Bathrooms",
            key: "bathrooms",
            align: "center",
            render: (_, record) =>
                formatRange(record.bathrooms.min, record.bathrooms.max),
        },
        {
            title: "Area (m²)",
            key: "area",
            align: "center",
            render: (_, record) =>
                formatRange(record.area.min, record.area.max),
        },
        {
            title: "Price",
            key: "price",
            render: (_, record) => {
                if (!record.price.min) return "-";
                if (record.price.min === record.price.max)
                    return formatPrice(record.price.min);
                return `From ${formatPrice(record.price.min)}`;
            },
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* ── Main card ────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                {/* Stat Cards */}
                <div className="flex flex-wrap gap-3 mb-9">
                    <StatCard
                        icon={<Building2 size={22} />}
                        value={`${statistics.total_units}`}
                        label="Total Units"
                    />
                    <StatCard
                        icon={<CheckCircle2 size={22} />}
                        value={statistics.total_sold}
                        label="Total Sold"
                    />
                    <StatCard
                        icon={<TrendingUp size={22} />}
                        value={
                            statistics.total_units > 0
                                ? `${Math.round((statistics.total_sold / statistics.total_units) * 100)}%`
                                : "0%"
                        }
                        label="Sold %"
                    />
                    <StatCard
                        icon={<Clock size={22} />}
                        value={statistics.starting_price_formatted ?? "-"}
                        label="Starting Price"
                    />
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
                        <p className="text-sm leading-7 text-gray-600">
                            {project.description}
                        </p>
                    ) : null}

                    <div className="clear-both" />
                </div>
            </div>

            {/* ── Units Table ──────────────────────────────────────────── */}
            {/* <Card title="Units">
                {unitTypesSummary.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={unitTypesSummary}
                        rowKey="type"
                        pagination={false}
                        size="small"
                    />
                ) : (
                    <Empty description="No unit types added to this project" />
                )}
            </Card> */}
        </div>
    );
};

export default OverviewSection;
