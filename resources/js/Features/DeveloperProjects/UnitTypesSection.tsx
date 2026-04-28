/**
 * UnitTypesSection — displayed on the DeveloperProject Show page.
 *
 * Shows a responsive card grid of unit types with expandable detail panels,
 * and an "Add Unit Type" button that opens UnitTypeFormModal.
 */

import React, { useState } from "react";
import {
    Button,
    Card,
    Tag,
    Space,
    Popconfirm,
    Empty,
    Typography,
    Badge,
    Image,
    App,
    Modal,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    CopyOutlined,
    GiftOutlined,
    HomeOutlined,
    DollarOutlined,
    PictureOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import type {
    DeveloperProjectUnitType,
    DeveloperProjectUnitTypeAsset,
} from "@/Types/developerProject";
import type { Offer } from "@/Types/api/offers";
import UnitTypeFormModal from "./UnitTypeFormModal";
import OfferAttachSection from "@/Features/Offers/OfferAttachSection";
import {
    getCurrencySymbol,
    VIEW_TYPE_OPTIONS,
    UNIT_STYLE_OPTIONS,
    FURNITURE_STATUS_OPTIONS,
    OUTSIDE_FEATURE_OPTIONS,
    INSIDE_FEATURE_OPTIONS,
    FLOOR_OPTIONS,
} from "./unitTypeConfig";
import { generatePropertySubtitle, snakeToReadable } from "@/lib/utils";
import dayjs from "dayjs";

const { Text, Paragraph } = Typography;

// ============================================
// Props
// ============================================

interface UnitTypesSectionProps {
    projectId: number;
    unitTypes: DeveloperProjectUnitType[];
    /**
     * Optional callback for refreshing data after mutations.
     * When provided, uses this instead of router.reload (for API-driven contexts like modals).
     * When omitted, falls back to router.reload() for Inertia pages.
     */
    onRefresh?: () => void;
}

// ============================================
// Helpers
// ============================================

const labelFor = (
    value: string | null,
    options: readonly { value: string; label: string }[],
): string => {
    if (!value) return "-";
    return options.find((o) => o.value === value)?.label ?? value;
};

const labelsFor = (
    values: string[] | null,
    options: readonly { value: string; label: string }[],
): string[] => {
    if (!values?.length) return [];
    return values.map((v) => options.find((o) => o.value === v)?.label ?? v);
};

const formatPrice = (price: number | null, currency: string): string => {
    if (price === null || price === undefined) return "-";
    const sym = getCurrencySymbol(currency);
    return `${sym}${Number(price).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const categoryColor = (cat: string) =>
    cat === "residential" ? "blue" : "orange";

const getAssetUrl = (asset?: DeveloperProjectUnitTypeAsset): string | null =>
    asset?.url ?? asset?.external_url ?? null;

const getImageAssets = (
    unitType: DeveloperProjectUnitType,
): DeveloperProjectUnitTypeAsset[] =>
    (unitType.assets ?? []).filter(
        (asset): asset is DeveloperProjectUnitTypeAsset =>
            asset.asset_type === "image" && !!getAssetUrl(asset),
    );

const getUnitTypeTitle = (unitType: DeveloperProjectUnitType) =>
    generatePropertySubtitle(unitType) ?? unitType.display_label ?? "Unit Type";

const formatOfferValue = (offer: Offer) =>
    offer.type === "percentage"
        ? `${offer.value}%`
        : Number(offer.value).toLocaleString("en-GB");

// ── Mini helpers ────────────────────────────────────────────────────────────

const SpecRow: React.FC<{ label: string; value: string }> = ({
    label,
    value,
}) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
            {label}
        </span>
        <span className="text-xs text-gray-700 font-medium">{value}</span>
    </div>
);

const FeatureTags: React.FC<{
    label: string;
    items: string[];
    color: string;
}> = ({ label, items, color }) => (
    <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1">
            {label}:
        </span>
        {items.map((item) => (
            <Tag key={item} color={color} className="!text-[11px] !m-0">
                {item}
            </Tag>
        ))}
    </div>
);

// ── UnitTypeCard ─────────────────────────────────────────────────────────────

interface UnitTypeCardProps {
    unitType: DeveloperProjectUnitType;
    expanded: boolean;
    onToggle: () => void;
    onEdit: (ut: DeveloperProjectUnitType) => void;
    onDuplicate: (ut: DeveloperProjectUnitType) => void;
    onDelete: (ut: DeveloperProjectUnitType) => void;
    onRefresh: () => void;
}

const UnitTypeCard: React.FC<UnitTypeCardProps> = ({
    unitType: ut,
    expanded,
    onToggle,
    onEdit,
    onDuplicate,
    onDelete,
    onRefresh,
}) => {
    const viewLabels = labelsFor(ut.view_types, VIEW_TYPE_OPTIONS);
    const styleLabels = labelsFor(ut.unit_style, UNIT_STYLE_OPTIONS);
    const outsideLabels = labelsFor(
        ut.outside_features,
        OUTSIDE_FEATURE_OPTIONS,
    );
    const insideLabels = labelsFor(ut.inside_features, INSIDE_FEATURE_OPTIONS);
    const floorLabel = labelFor(ut.floor, FLOOR_OPTIONS);
    const furnitureLabel = labelFor(
        ut.furniture_status,
        FURNITURE_STATUS_OPTIONS,
    );
    const imageAssets = getImageAssets(ut);
    const imageUrls = imageAssets
        .map((asset) => getAssetUrl(asset)!)
        .filter(Boolean);
    const heroImage = imageUrls[0] ?? null;
    const title = getUnitTypeTitle(ut);
    const offerCount = ut.offers?.length ?? 0;
    const { message } = App.useApp();

    return (
        <>
            <div className="border border-gray-200 rounded-xl bg-white flex flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md">
                <div className="relative h-48 bg-gray-100">
                    {heroImage ? (
                        <img
                            src={heroImage}
                            alt={title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                            <HomeOutlined style={{ fontSize: 34 }} />
                        </div>
                    )}

                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                        <Tag
                            color={categoryColor(ut.primary_category)}
                            className="!m-0 !rounded-full !px-2.5 !py-0.5 !text-[10px]"
                        >
                            {ut.primary_category === "residential"
                                ? "Residential"
                                : "Commercial"}
                        </Tag>
                        {ut.reference_code && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm cursor-pointer"
                                onClick={() => {
                                    navigator.clipboard.writeText(
                                        ut.reference_code!,
                                    );
                                    message.success("Code copied");
                                }}
                            >
                                <span>{ut.reference_code}</span>
                                <CopyOutlined style={{ fontSize: 11 }} />
                            </button>
                        )}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/65 to-transparent">
                        <div className="shrink-0 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white">
                            {imageUrls.length} photo
                            {imageUrls.length === 1 ? "" : "s"}
                        </div>
                    </div>
                </div>

                <div className="px-4 py-4 flex flex-col gap-y-3 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex flex-col gap-y-1">
                            <div className="min-w-0">
                                <div className="text-base font-semibold leading-tight line-clamp-2">
                                    {title}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 capitalize">
                                <HomeOutlined className="shrink-0" />
                                <span className="truncate">
                                    {ut.property_type?.replace(/_/g, " ") ??
                                        "Unit type"}
                                    {ut.floor
                                        ? ` · ${snakeToReadable(floorLabel)}`
                                        : " "}
                                    {ut.furniture_status
                                        ? ` · ${furnitureLabel}`
                                        : ""}
                                </span>
                            </div>
                            {ut.completion_date && (
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                    <InfoCircleOutlined className="shrink-0" />
                                    <span className="truncate">
                                        {ut.completion_date
                                            ? ` · Completion Date: ${dayjs(ut.completion_date).format("D MMMM YYYY")}`
                                            : ""}
                                    </span>
                                </div>
                            )}
                        </div>

                        {ut.starting_price != null && (
                            <div className="text-right shrink-0">
                                <div className="flex items-center justify-end gap-1 text-[11px] text-gray-500 uppercase tracking-wide">
                                    <DollarOutlined />
                                    <span>Starting from</span>
                                </div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {formatPrice(
                                        ut.starting_price,
                                        ut.currency,
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 lg:grid-cols-3 xxl:grid-cols-4">
                        {ut.bedrooms != null && (
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                                    Bedrooms
                                </div>
                                <div className="font-semibold text-gray-800">
                                    {ut.bedrooms}
                                </div>
                            </div>
                        )}
                        {ut.bathrooms != null && (
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                                    Bathrooms
                                </div>
                                <div className="font-semibold text-gray-800">
                                    {ut.bathrooms}
                                </div>
                            </div>
                        )}
                        {ut.total_area_sqm != null && (
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                                    Total Area
                                </div>
                                <div className="font-semibold text-gray-800">
                                    {Number(ut.total_area_sqm).toLocaleString()}{" "}
                                    m²
                                </div>
                            </div>
                        )}
                        {ut.plot_size_sqm != null && (
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                                    Plot Size
                                </div>
                                <div className="font-semibold text-gray-800">
                                    {Number(ut.plot_size_sqm).toLocaleString()}{" "}
                                    m²
                                </div>
                            </div>
                        )}
                    </div>

                    {ut.description && (
                        <Paragraph
                            ellipsis={{ rows: 2 }}
                            className="!mb-0 !text-xs text-gray-600"
                        >
                            {ut.description}
                        </Paragraph>
                    )}
                </div>

                <div className="border-t border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-gray-50/70">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button icon={<EyeOutlined />} onClick={onToggle}>
                            View details
                        </Button>
                        <Button icon={<GiftOutlined />} onClick={onToggle}>
                            Offers{offerCount > 0 ? ` (${offerCount})` : ""}
                        </Button>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(ut)}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => onDuplicate(ut)}
                            title="Duplicate"
                        />
                        <Popconfirm
                            title="Delete this unit type?"
                            description="This action cannot be undone."
                            onConfirm={() => onDelete(ut)}
                            okText="Delete"
                            okType="danger"
                        >
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Popconfirm>
                    </div>
                </div>
            </div>

            <Modal
                open={expanded}
                onCancel={onToggle}
                footer={null}
                width={1080}
                title={
                    <div className="flex flex-col gap-1 pr-8">
                        <span className="text-lg font-semibold text-gray-900">
                            {title}
                        </span>
                        <span className="text-sm text-gray-500 capitalize">
                            {ut.property_type?.replace(/_/g, " ") ??
                                "Unit type"}
                        </span>
                    </div>
                }
            >
                <div className="flex flex-col gap-y-6">
                    <Image.PreviewGroup items={imageUrls}>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 min-h-[280px]">
                                {heroImage ? (
                                    <Image
                                        src={heroImage}
                                        alt={title}
                                        className="h-full w-full object-cover"
                                        style={{
                                            height: 360,
                                            width: "100%",
                                            objectFit: "cover",
                                        }}
                                        preview={{ mask: <EyeOutlined /> }}
                                    />
                                ) : (
                                    <div className="h-full min-h-[280px] flex items-center justify-center text-gray-300">
                                        <HomeOutlined
                                            style={{ fontSize: 40 }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-y-3">
                                <Card size="small" className="!rounded-2xl">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                                Starting price
                                            </div>
                                            <div className="text-2xl font-semibold text-gray-900 mt-1">
                                                {ut.starting_price != null
                                                    ? formatPrice(
                                                          ut.starting_price,
                                                          ut.currency,
                                                      )
                                                    : "-"}
                                            </div>
                                        </div>
                                        <Tag
                                            color={categoryColor(
                                                ut.primary_category,
                                            )}
                                            className="!m-0"
                                        >
                                            {snakeToReadable(
                                                ut.primary_category,
                                            )}
                                        </Tag>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <SpecRow
                                            label="Reference"
                                            value={ut.reference_code || "-"}
                                        />

                                        <SpecRow
                                            label="Photos"
                                            value={String(imageUrls.length)}
                                        />
                                        <SpecRow
                                            label="Offers"
                                            value={String(offerCount)}
                                        />
                                    </div>
                                </Card>

                                {imageUrls.length > 1 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {imageUrls
                                            .slice(1, 7)
                                            .map((url, index) => (
                                                <Image
                                                    key={`${url}-${index}`}
                                                    src={url}
                                                    alt={`${title} ${index + 2}`}
                                                    className="rounded-xl object-cover"
                                                    style={{
                                                        height: 88,
                                                        width: "100%",
                                                        objectFit: "cover",
                                                    }}
                                                    preview={{
                                                        mask: <EyeOutlined />,
                                                    }}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Image.PreviewGroup>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
                        <div className="flex flex-col gap-y-4">
                            <Card
                                size="small"
                                title="Overview"
                                className="!rounded-2xl"
                            >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    <SpecRow
                                        label="Property Type"
                                        value={
                                            ut.property_type
                                                ? snakeToReadable(
                                                      ut.property_type,
                                                  )
                                                : "-"
                                        }
                                    />
                                    <SpecRow label="Floor" value={floorLabel} />
                                    <SpecRow
                                        label="Furniture"
                                        value={furnitureLabel}
                                    />
                                    <SpecRow
                                        label="Completion"
                                        value={
                                            dayjs(ut.completion_date).format(
                                                "D MMMM YYYY",
                                            ) || "-"
                                        }
                                    />
                                    <SpecRow
                                        label="Living Area"
                                        value={
                                            ut.living_area_sqm != null
                                                ? `${Number(ut.living_area_sqm).toLocaleString()} m²`
                                                : "-"
                                        }
                                    />
                                    <SpecRow
                                        label="Terrace / Balcony"
                                        value={
                                            ut.terrace_balcony_sqm != null
                                                ? `${Number(ut.terrace_balcony_sqm).toLocaleString()} m²`
                                                : "-"
                                        }
                                    />
                                </div>

                                {ut.description && (
                                    <Paragraph className="!mb-0 !mt-4 whitespace-pre-wrap text-sm text-gray-700">
                                        {ut.description}
                                    </Paragraph>
                                )}
                            </Card>

                            {(viewLabels.length > 0 ||
                                styleLabels.length > 0 ||
                                outsideLabels.length > 0 ||
                                insideLabels.length > 0) && (
                                <Card
                                    size="small"
                                    title="Features"
                                    className="!rounded-2xl"
                                >
                                    <div className="flex flex-col gap-3">
                                        {viewLabels.length > 0 && (
                                            <FeatureTags
                                                label="Views"
                                                items={viewLabels}
                                                color="geekblue"
                                            />
                                        )}
                                        {styleLabels.length > 0 && (
                                            <FeatureTags
                                                label="Styles"
                                                items={styleLabels}
                                                color="purple"
                                            />
                                        )}
                                        {outsideLabels.length > 0 && (
                                            <FeatureTags
                                                label="Outside"
                                                items={outsideLabels}
                                                color="green"
                                            />
                                        )}
                                        {insideLabels.length > 0 && (
                                            <FeatureTags
                                                label="Inside"
                                                items={insideLabels}
                                                color="cyan"
                                            />
                                        )}
                                    </div>
                                </Card>
                            )}
                        </div>

                        <div className="flex flex-col gap-y-4">
                            <Card
                                size="small"
                                title={
                                    <span className="flex items-center gap-2">
                                        <PictureOutlined />
                                        Media & facts
                                    </span>
                                }
                                className="!rounded-2xl"
                            >
                                <div className="flex flex-col gap-y-3">
                                    <SpecRow
                                        label="Bedrooms"
                                        value={
                                            ut.bedrooms != null
                                                ? String(ut.bedrooms)
                                                : "-"
                                        }
                                    />
                                    <SpecRow
                                        label="Bathrooms"
                                        value={
                                            ut.bathrooms != null
                                                ? String(ut.bathrooms)
                                                : "-"
                                        }
                                    />
                                    <SpecRow
                                        label="Total Area"
                                        value={
                                            ut.total_area_sqm != null
                                                ? `${Number(ut.total_area_sqm).toLocaleString()} m²`
                                                : "-"
                                        }
                                    />
                                    <SpecRow
                                        label="Military Distance"
                                        value={
                                            ut.military_base_distance_km != null
                                                ? `${ut.military_base_distance_km} km`
                                                : "-"
                                        }
                                    />
                                    <SpecRow
                                        label="Restrictions"
                                        value={
                                            ut.has_restrictions
                                                ? ut.restriction_notes || "Yes"
                                                : "None"
                                        }
                                    />
                                </div>
                            </Card>

                            <Card
                                size="small"
                                title={
                                    <span className="flex items-center gap-2">
                                        <GiftOutlined />
                                        Offer actions
                                    </span>
                                }
                                className="!rounded-2xl"
                            >
                                {offerCount > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {ut.offers!.map((offer) => (
                                            <Tag
                                                key={offer.id}
                                                color={
                                                    offer.type === "percentage"
                                                        ? "blue"
                                                        : "green"
                                                }
                                                className="!m-0"
                                            >
                                                {formatOfferValue(offer)}
                                            </Tag>
                                        ))}
                                    </div>
                                )}
                                <OfferAttachSection
                                    offers={ut.offers ?? []}
                                    offerableType="unit_type"
                                    offerableId={ut.id}
                                    onRefresh={onRefresh}
                                />
                            </Card>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

// ============================================
// Component
// ============================================

const UnitTypesSection: React.FC<UnitTypesSectionProps> = ({
    projectId,
    unitTypes,
    onRefresh,
}) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] =
        useState<DeveloperProjectUnitType | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const handleDelete = (unitType: DeveloperProjectUnitType) => {
        const url = route("developer-projects.unit-types.destroy", {
            projectId,
            unitTypeId: unitType.id,
        });

        if (onRefresh) {
            fetch(url, {
                method: "DELETE",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
            }).then(() => {
                onRefresh();
            });
        } else {
            router.delete(url, { preserveScroll: true });
        }
    };

    const handleEdit = (unitType: DeveloperProjectUnitType) => {
        setEditingItem(unitType);
        setIsDuplicating(false);
        setModalOpen(true);
    };

    const handleDuplicate = (unitType: DeveloperProjectUnitType) => {
        setEditingItem(unitType);
        setIsDuplicating(true);
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingItem(null);
        setIsDuplicating(false);
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setEditingItem(null);
        setIsDuplicating(false);
    };

    const handleSuccess = () => {
        if (onRefresh) {
            onRefresh();
        } else {
            router.reload({ only: ["unitTypes", "project"] });
        }
    };

    // ---- Render ----

    return (
        <div className="flex flex-col gap-4">
            <Card
                title={
                    <Space>
                        <span>Unit Types</span>
                        <Badge
                            count={unitTypes.length}
                            style={{ backgroundColor: "#1677ff" }}
                        />
                    </Space>
                }
                extra={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                    >
                        Add Unit Type
                    </Button>
                }
            >
                {unitTypes.length === 0 ? (
                    <Empty
                        description="No unit types added yet"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                        <Button type="primary" onClick={handleAdd}>
                            Add First Unit Type
                        </Button>
                    </Empty>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-4">
                        {unitTypes.map((ut) => (
                            <UnitTypeCard
                                key={ut.id}
                                unitType={ut}
                                expanded={expandedId === ut.id}
                                onToggle={() =>
                                    setExpandedId((prev) =>
                                        prev === ut.id ? null : ut.id,
                                    )
                                }
                                onEdit={handleEdit}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                onRefresh={handleSuccess}
                            />
                        ))}
                    </div>
                )}
            </Card>

            <UnitTypeFormModal
                open={modalOpen}
                onClose={handleModalClose}
                projectId={projectId}
                editingItem={editingItem}
                isDuplicating={isDuplicating}
                onSuccess={handleSuccess}
            />
        </div>
    );
};

export default UnitTypesSection;
