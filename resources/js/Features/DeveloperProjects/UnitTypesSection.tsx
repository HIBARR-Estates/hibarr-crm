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
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    CopyOutlined,
    GiftOutlined,
    DownOutlined,
    UpOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import type { DeveloperProjectUnitType } from "@/Types/developerProject";
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
     * When omitted, falls back to router.reload({ only: ["project"] }) for Inertia pages.
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

// ── Mini helpers ────────────────────────────────────────────────────────────

const SpecRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="text-xs text-gray-700 font-medium">{value}</span>
    </div>
);

const FeatureTags: React.FC<{ label: string; items: string[]; color: string }> = ({
    label,
    items,
    color,
}) => (
    <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1">{label}:</span>
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
    const outsideLabels = labelsFor(ut.outside_features, OUTSIDE_FEATURE_OPTIONS);
    const insideLabels = labelsFor(ut.inside_features, INSIDE_FEATURE_OPTIONS);
    const floorLabel = labelFor(ut.floor, FLOOR_OPTIONS);
    const furnitureLabel = labelFor(ut.furniture_status, FURNITURE_STATUS_OPTIONS);

    const hasExpandableContent = !!(
        ut.description ||
        ut.view_types?.length ||
        ut.unit_style?.length ||
        ut.outside_features?.length ||
        ut.inside_features?.length ||
        ut.assets?.length ||
        ut.floor ||
        ut.completion_date ||
        ut.living_area_sqm ||
        ut.terrace_balcony_sqm ||
        ut.plot_size_sqm ||
        ut.military_base_distance_km
    );

    return (
        <div className="border border-gray-200 rounded-xl bg-white flex flex-col overflow-hidden">
            {/* ── Card header: type + ref + actions ── */}
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag
                            color={categoryColor(ut.primary_category)}
                            className="!text-[10px] !m-0 !px-1.5 !py-0"
                        >
                            {ut.primary_category === "residential" ? "Residential" : "Commercial"}
                        </Tag>
                        <span className="text-[13px] font-semibold text-gray-800 leading-tight">
                            {generatePropertySubtitle(ut) ?? ut.display_label ??"Unit Type"}
                        </span>
                    </div>
                    {ut.reference_code && (
                        <Text code className="!text-[11px] text-gray-400">
                            {ut.reference_code}
                        </Text>
                    )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
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
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </div>
            </div>

            {/* ── Stats row ── */}
            <div className="px-4 py-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {ut.quantity != null && ut.quantity > 1 && (
                        <span className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Qty</span>
                            <span className="font-semibold text-gray-800">{ut.quantity}</span>
                        </span>
                    )}
                    {ut.bedrooms != null && (
                        <span className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Bed</span>
                            <span className="font-semibold text-gray-800">{ut.bedrooms}</span>
                        </span>
                    )}
                    {ut.bathrooms != null && (
                        <span className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Bath</span>
                            <span className="font-semibold text-gray-800">{ut.bathrooms}</span>
                        </span>
                    )}
                    {ut.total_area_sqm != null && (
                        <span className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Area</span>
                            <span className="font-semibold text-gray-800">
                                {Number(ut.total_area_sqm).toLocaleString()} m²
                            </span>
                        </span>
                    )}
                    {ut.starting_price != null && (
                        <span className="ml-auto font-bold text-gray-800 text-sm">
                            {formatPrice(ut.starting_price, ut.currency)}
                        </span>
                    )}
                </div>

                {/* Offer tags */}
                {(ut.offers?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {ut.offers!.map((offer: Offer) => (
                            <Tag
                                key={offer.id}
                                color={offer.type === "percentage" ? "blue" : "green"}
                                icon={<GiftOutlined />}
                                className="!text-[11px] !m-0"
                            >
                                {offer.type === "percentage"
                                    ? `${offer.value}%`
                                    : Number(offer.value).toLocaleString("en-GB")}
                            </Tag>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Expand toggle + detail panel ── */}
            {hasExpandableContent && (
                <>
                    <button
                        type="button"
                        className="w-full px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-t border-gray-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        onClick={onToggle}
                    >
                        {expanded ? (
                            <UpOutlined style={{ fontSize: 11 }} />
                        ) : (
                            <DownOutlined style={{ fontSize: 11 }} />
                        )}
                        {expanded ? "Hide details" : "Show details"}
                    </button>

                    {expanded && (
                        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/40 flex flex-col gap-3">
                            {/* Spec grid */}
                            {(ut.floor ||
                                ut.floors_in_building ||
                                ut.living_area_sqm ||
                                ut.terrace_balcony_sqm ||
                                ut.plot_size_sqm ||
                                ut.furniture_status ||
                                ut.completion_date ||
                                ut.military_base_distance_km ||
                                ut.has_restrictions) && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                    {ut.floor && (
                                        <SpecRow label="Floor" value={floorLabel} />
                                    )}
                                    {ut.floors_in_building && (
                                        <SpecRow
                                            label="Floors in Building"
                                            value={String(ut.floors_in_building)}
                                        />
                                    )}
                                    {ut.living_area_sqm && (
                                        <SpecRow
                                            label="Living Area"
                                            value={`${Number(ut.living_area_sqm).toLocaleString()} m²`}
                                        />
                                    )}
                                    {ut.terrace_balcony_sqm && (
                                        <SpecRow
                                            label="Terrace / Balcony"
                                            value={`${Number(ut.terrace_balcony_sqm).toLocaleString()} m²`}
                                        />
                                    )}
                                    {ut.plot_size_sqm && (
                                        <SpecRow
                                            label="Plot Size"
                                            value={`${Number(ut.plot_size_sqm).toLocaleString()} m²`}
                                        />
                                    )}
                                    {ut.furniture_status && (
                                        <SpecRow label="Furniture" value={furnitureLabel} />
                                    )}
                                    {ut.completion_date && (
                                        <SpecRow label="Completion" value={ut.completion_date} />
                                    )}
                                    {ut.military_base_distance_km && (
                                        <SpecRow
                                            label="Military Dist."
                                            value={`${ut.military_base_distance_km} km`}
                                        />
                                    )}
                                    {ut.has_restrictions && (
                                        <SpecRow
                                            label="Restrictions"
                                            value={ut.restriction_notes || "Yes"}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Feature tags */}
                            {viewLabels.length > 0 && (
                                <FeatureTags label="Views" items={viewLabels} color="geekblue" />
                            )}
                            {styleLabels.length > 0 && (
                                <FeatureTags label="Styles" items={styleLabels} color="purple" />
                            )}
                            {outsideLabels.length > 0 && (
                                <FeatureTags
                                    label="Outside"
                                    items={outsideLabels}
                                    color="green"
                                />
                            )}
                            {insideLabels.length > 0 && (
                                <FeatureTags label="Inside" items={insideLabels} color="cyan" />
                            )}

                            {/* Description */}
                            {ut.description && (
                                <Paragraph
                                    ellipsis={{ rows: 3, expandable: true }}
                                    className="!text-xs text-gray-600 !mb-0"
                                >
                                    {ut.description}
                                </Paragraph>
                            )}

                            {/* Image strip */}
                            {ut.assets && ut.assets.length > 0 && (
                                <div>
                                    <Image.PreviewGroup>
                                        <div className="flex flex-wrap gap-1.5">
                                            {ut.assets.slice(0, 6).map((asset) => (
                                                <Image
                                                    key={asset.id}
                                                    src={asset.url ?? asset.external_url ?? ""}
                                                    width={48}
                                                    height={48}
                                                    className="object-cover rounded"
                                                    preview={{ mask: <EyeOutlined /> }}
                                                />
                                            ))}
                                            {ut.assets.length > 6 && (
                                                <span className="text-xs text-gray-400 self-center">
                                                    +{ut.assets.length - 6} more
                                                </span>
                                            )}
                                        </div>
                                    </Image.PreviewGroup>
                                </div>
                            )}

                            {/* Offer attach */}
                            <div>
                                <Text type="secondary" className="text-xs block mb-1">
                                    Offer:
                                </Text>
                                <OfferAttachSection
                                    offers={ut.offers ?? []}
                                    offerableType="unit_type"
                                    offerableId={ut.id}
                                    onRefresh={onRefresh}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
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
    const [editingItem, setEditingItem] = useState<DeveloperProjectUnitType | null>(null);
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
            router.reload({ only: ["project"] });
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
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
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
                    <div className="grid grid-cols-1 gap-4">
                        {unitTypes.map((ut) => (
                            <UnitTypeCard
                                key={ut.id}
                                unitType={ut}
                                expanded={expandedId === ut.id}
                                onToggle={() =>
                                    setExpandedId((prev) => (prev === ut.id ? null : ut.id))
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
