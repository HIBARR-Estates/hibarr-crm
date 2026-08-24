import React, { useState, useMemo } from "react";
import { Button } from "antd";
import {
    Building2,
    CheckCircle2,
    DollarSign,
    Euro,
    MapPin,
    PoundSterling,
    TrendingUp,
    TurkishLira,
} from "lucide-react";
import type {
    ShowProps,
    UnitTypeSummary,
    Statistics,
    ImageItem,
} from "../Show";
import type { ProjectDistances } from "@/Types/developerProject";
import { formatLocationNameForDisplay } from "../../../lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { HtmlRenderer } from "@/Components/ContentRenderer";
import { DISTANCE_FIELDS } from "@/Features/Properties/SaveProperty/constructionProjectConfig";

// ── Currency icon ─────────────────────────────────────────────────────────
const CURRENCY_ICONS: Record<string, React.ReactNode> = {
    EUR: <Euro size={22} />,
    GBP: <PoundSterling size={22} />,
    USD: <DollarSign size={22} />,
    TRY: <TurkishLira size={22} />,
};

const DESCRIPTION_PREVIEW_LENGTH = 360;

const stripHtml = (html: string): string =>
    html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

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

const ProjectDescription: React.FC<{ html: string }> = ({ html }) => {
    const [expanded, setExpanded] = useState(false);
    const { td } = useTd();
    const plainLength = stripHtml(html).length;
    const needsTruncate = plainLength > DESCRIPTION_PREVIEW_LENGTH;

    return (
        <div>
            <HtmlRenderer
                content={html}
                className="text-sm leading-7 text-gray-600 [&_p]:mb-3 [&_p:last-child]:mb-0"
                maxLength={
                    needsTruncate && !expanded
                        ? DESCRIPTION_PREVIEW_LENGTH
                        : undefined
                }
                showFullContent={expanded || !needsTruncate}
            />
            {needsTruncate && (
                <Button
                    type="link"
                    size="small"
                    className="!mt-1 !h-auto !px-0"
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    {td(expanded ? "Show less" : "Show more", { source: "en" })}
                </Button>
            )}
        </div>
    );
};

const formatDistance = (value: number | null | undefined): string | null => {
    if (value == null || Number.isNaN(Number(value))) return null;
    const num = Number(value);
    return Number.isInteger(num) ? `${num} km` : `${num.toFixed(1)} km`;
};

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
    imagesByTag,
}) => {
    const [imgError, setImgError] = useState(false);
    const { td } = useTd();

    // Prefer cover/thumbnail, then any project-source gallery image
    const heroImage = useMemo(() => {
        const thumbnailUrl =
            project.thumbnail?.url ?? project.thumbnail?.external_url ?? null;
        if (thumbnailUrl) return thumbnailUrl;

        const coverAsset = (project.assets ?? []).find(
            (asset) =>
                asset.asset_type === "image" &&
                (asset.tags ?? []).includes("cover") &&
                (asset.url || asset.external_url),
        );
        if (coverAsset) {
            return coverAsset.url ?? coverAsset.external_url ?? null;
        }

        if (!imagesByTag) return null;
        for (const images of Object.values(imagesByTag)) {
            const src = images.find((img) => img.source === "project");
            if (src) return src.url;
        }
        for (const images of Object.values(imagesByTag)) {
            if (images.length > 0) return images[0].url;
        }
        return null;
    }, [imagesByTag, project.assets, project.thumbnail]);

    const location = project.location;
    const distances = (project.distances ?? {}) as ProjectDistances;
    const distanceRows = DISTANCE_FIELDS.map((field) => {
        const formatted = formatDistance(
            distances[field.key as keyof ProjectDistances],
        );
        return formatted
            ? { key: field.key, label: field.label, value: formatted }
            : null;
    }).filter(Boolean) as { key: string; label: string; value: string }[];

    const addressText =
        location?.full_address ||
        location?.address?.street ||
        null;

    const hasLocationBlock =
        Boolean(location?.name) ||
        Boolean(addressText) ||
        Boolean(location?.map_url) ||
        distanceRows.length > 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                {/* Stat cards — price first (LTR importance) */}
                <div className="flex flex-wrap gap-3 mb-9">
                    <StatCard
                        icon={
                            CURRENCY_ICONS[
                                statistics.starting_price_currency
                            ] ?? <PoundSterling size={22} />
                        }
                        value={statistics.starting_price_formatted ?? "-"}
                        label={td("Starting Price", { source: "en" })}
                    />
                    <StatCard
                        icon={<Building2 size={22} />}
                        value={`${statistics.total_units}`}
                        label={td("Total Units", { source: "en" })}
                    />
                    <StatCard
                        icon={<CheckCircle2 size={22} />}
                        value={statistics.total_sold}
                        label={td("Total Sold", { source: "en" })}
                    />
                    <StatCard
                        icon={<TrendingUp size={22} />}
                        value={
                            statistics.total_units > 0
                                ? `${Math.round((statistics.total_sold / statistics.total_units) * 100)}%`
                                : "0%"
                        }
                        label={td("Sold %", { source: "en" })}
                    />
                </div>

                {/* Description with floated hero image */}
                <div className="clearfix">
                    {heroImage && !imgError ? (
                        <div className="mb-4 rounded-xl overflow-hidden shadow-lg w-full min-h-52 md:float-right md:ml-6 md:w-2/5">
                            <img
                                src={heroImage}
                                alt={project.name}
                                loading="lazy"
                                decoding="async"
                                onError={() => setImgError(true)}
                                className="w-full h-full object-cover block min-h-52"
                            />
                        </div>
                    ) : null}

                    {project.description ? (
                        <ProjectDescription html={project.description} />
                    ) : null}

                    <div className="clear-both" />
                </div>

                {/* Location & proximity — visible to all viewers */}
                {hasLocationBlock && (
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <div className="mb-4 flex items-center gap-2">
                            <MapPin size={16} className="text-[#1a2a6c]" />
                            <h3 className="text-sm font-semibold text-slate-900">
                                {td("Location & proximity", { source: "en" })}
                            </h3>
                        </div>

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex flex-col gap-1.5">
                                {location?.name && (
                                    <p className="text-sm font-medium text-gray-900">
                                        {formatLocationNameForDisplay(
                                            location.name,
                                        )}
                                    </p>
                                )}
                                {addressText && (
                                    <p className="text-sm text-gray-600">
                                        {addressText}
                                    </p>
                                )}
                                {location?.map_url && (
                                    <a
                                        href={location.map_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:text-blue-800 w-fit"
                                    >
                                        {td("Open in maps", { source: "en" })}
                                    </a>
                                )}
                            </div>

                            {distanceRows.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:min-w-[320px]">
                                    {distanceRows.map((row) => (
                                        <div
                                            key={row.key}
                                            className="flex flex-col gap-0.5"
                                        >
                                            <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                                {td(row.label, {
                                                    source: "en",
                                                })}
                                            </span>
                                            <span className="text-sm font-medium text-gray-800">
                                                {row.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OverviewSection;
