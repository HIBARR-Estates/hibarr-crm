/**
 * UnitTypesSection — displayed on the DeveloperProject Show page.
 *
 * Shows a table of unit types with key columns, expandable detail rows,
 * and an "Add Unit Type" button that opens UnitTypeFormModal.
 */

import { useState, useCallback } from "react";
import {
    Button,
    Card,
    Table,
    Tag,
    Space,
    Popconfirm,
    Empty,
    Descriptions,
    Typography,
    Badge,
    Row,
    Col,
    Image,
} from "antd";
import type { TableColumnsType } from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    CopyOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import type { DeveloperProjectUnitType } from "@/Types/developerProject";
import UnitTypeFormModal from "./UnitTypeFormModal";
import {
    getCurrencySymbol,
    VIEW_TYPE_OPTIONS,
    UNIT_STYLE_OPTIONS,
    FURNITURE_STATUS_OPTIONS,
    OUTSIDE_FEATURE_OPTIONS,
    INSIDE_FEATURE_OPTIONS,
    FLOOR_OPTIONS,
} from "./unitTypeConfig";

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

    const handleDelete = (unitType: DeveloperProjectUnitType) => {
        const url = route("developer-projects.unit-types.destroy", {
            projectId,
            unitTypeId: unitType.id,
        });

        if (onRefresh) {
            // API-driven context (e.g. inside a modal on Properties/Index)
            // Use fetch + callback instead of Inertia router
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
            // Inertia page context (e.g. DeveloperProjects/Show)
            router.delete(url, {
                preserveScroll: true,
            });
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

    // ---- Table columns ----

    const columns: TableColumnsType<DeveloperProjectUnitType> = [
        {
            title: "Ref",
            dataIndex: "reference_code",
            key: "reference_code",
            width: 140,
            render: (code: string | null) => (
                <Text code className="text-xs">
                    {code ?? "-"}
                </Text>
            ),
        },
        {
            title: "Category",
            dataIndex: "primary_category",
            key: "primary_category",
            width: 110,
            render: (cat: string) => (
                <Tag color={categoryColor(cat)}>
                    {cat === "residential" ? "Residential" : "Commercial"}
                </Tag>
            ),
        },
        {
            title: "Type",
            dataIndex: "property_type",
            key: "property_type",
            width: 150,
            render: (type: string | null) => (
                <Tag>
                    {type
                        ?.replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "-"}
                </Tag>
            ),
        },
        {
            title: "Beds",
            dataIndex: "bedrooms",
            key: "bedrooms",
            width: 60,
            align: "center",
            render: (v: number | null) => v ?? "-",
        },
        {
            title: "Baths",
            dataIndex: "bathrooms",
            key: "bathrooms",
            width: 60,
            align: "center",
            render: (v: number | null) => v ?? "-",
        },
        {
            title: "Area (m²)",
            dataIndex: "total_area_sqm",
            key: "total_area_sqm",
            width: 100,
            align: "right",
            render: (v: number | null) =>
                v !== null ? Number(v).toLocaleString() : "-",
        },
        {
            title: "Price",
            key: "price",
            width: 120,
            align: "right",
            render: (_, record) =>
                formatPrice(record.starting_price, record.currency),
        },
        {
            title: "Actions",
            key: "actions",
            width: 130,
            align: "center",
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleDuplicate(record)}
                        title="Duplicate"
                    />
                    <Popconfirm
                        title="Delete this unit type?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDelete(record)}
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
                </Space>
            ),
        },
    ];

    // ---- Expandable row detail ----

    const expandedRowRender = (record: DeveloperProjectUnitType) => {
        const viewLabels = labelsFor(record.view_types, VIEW_TYPE_OPTIONS);
        const styleLabels = labelsFor(record.unit_style, UNIT_STYLE_OPTIONS);
        const outsideLabels = labelsFor(
            record.outside_features,
            OUTSIDE_FEATURE_OPTIONS,
        );
        const insideLabels = labelsFor(
            record.inside_features,
            INSIDE_FEATURE_OPTIONS,
        );
        const floorLabel = labelFor(record.floor, FLOOR_OPTIONS);
        const furnitureLabel = labelFor(
            record.furniture_status,
            FURNITURE_STATUS_OPTIONS,
        );

        return (
            <div className="py-2 px-4">
                <Row gutter={24}>
                    {/* Left Column — specifications */}
                    <Col span={12}>
                        <Descriptions
                            column={2}
                            size="small"
                            bordered
                            className="mb-3"
                        >
                            <Descriptions.Item label="Floor">
                                {floorLabel}
                            </Descriptions.Item>
                            <Descriptions.Item label="Floors in Building">
                                {record.floors_in_building ?? "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Living Area">
                                {record.living_area_sqm
                                    ? `${Number(record.living_area_sqm).toLocaleString()} m²`
                                    : "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Terrace/Balcony">
                                {record.terrace_balcony_sqm
                                    ? `${Number(record.terrace_balcony_sqm).toLocaleString()} m²`
                                    : "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Plot Size">
                                {record.plot_size_sqm
                                    ? `${Number(record.plot_size_sqm).toLocaleString()} m²`
                                    : "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Furniture">
                                {furnitureLabel}
                            </Descriptions.Item>
                            <Descriptions.Item label="Completion">
                                {record.completion_date ?? "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Military Distance">
                                {record.military_base_distance_km
                                    ? `${Number(record.military_base_distance_km)} km`
                                    : "-"}
                            </Descriptions.Item>
                            {record.has_restrictions && (
                                <Descriptions.Item
                                    label="Restrictions"
                                    span={2}
                                >
                                    <Badge status="warning" />{" "}
                                    {record.restriction_notes || "Yes"}
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    </Col>

                    {/* Right Column — tags & description */}
                    <Col span={12}>
                        {viewLabels.length > 0 && (
                            <div className="mb-2">
                                <Text type="secondary" className="text-xs">
                                    Views:
                                </Text>{" "}
                                {viewLabels.map((l) => (
                                    <Tag
                                        key={l}
                                        color="geekblue"
                                        className="mb-1"
                                    >
                                        {l}
                                    </Tag>
                                ))}
                            </div>
                        )}
                        {styleLabels.length > 0 && (
                            <div className="mb-2">
                                <Text type="secondary" className="text-xs">
                                    Styles:
                                </Text>{" "}
                                {styleLabels.map((l) => (
                                    <Tag
                                        key={l}
                                        color="purple"
                                        className="mb-1"
                                    >
                                        {l}
                                    </Tag>
                                ))}
                            </div>
                        )}
                        {outsideLabels.length > 0 && (
                            <div className="mb-2">
                                <Text type="secondary" className="text-xs">
                                    Outside:
                                </Text>{" "}
                                {outsideLabels.map((l) => (
                                    <Tag key={l} color="green" className="mb-1">
                                        {l}
                                    </Tag>
                                ))}
                            </div>
                        )}
                        {insideLabels.length > 0 && (
                            <div className="mb-2">
                                <Text type="secondary" className="text-xs">
                                    Inside:
                                </Text>{" "}
                                {insideLabels.map((l) => (
                                    <Tag key={l} color="cyan" className="mb-1">
                                        {l}
                                    </Tag>
                                ))}
                            </div>
                        )}
                        {record.description && (
                            <Paragraph
                                ellipsis={{ rows: 3, expandable: true }}
                                className="mt-2 text-sm text-gray-600"
                            >
                                {record.description}
                            </Paragraph>
                        )}
                        {/* Thumbnail strip */}
                        {record.assets && record.assets.length > 0 && (
                            <div className="mt-2">
                                <Image.PreviewGroup>
                                    <Space size={4} wrap>
                                        {record.assets
                                            .slice(0, 6)
                                            .map((asset) => (
                                                <Image
                                                    key={asset.id}
                                                    src={
                                                        asset.url ??
                                                        asset.external_url ??
                                                        ""
                                                    }
                                                    width={48}
                                                    height={48}
                                                    className="object-cover rounded"
                                                    preview={{
                                                        mask: <EyeOutlined />,
                                                    }}
                                                />
                                            ))}
                                        {record.assets.length > 6 && (
                                            <Text
                                                type="secondary"
                                                className="text-xs"
                                            >
                                                +{record.assets.length - 6} more
                                            </Text>
                                        )}
                                    </Space>
                                </Image.PreviewGroup>
                            </div>
                        )}
                    </Col>
                </Row>
            </div>
        );
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
                    <Table
                        dataSource={unitTypes}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        expandable={{
                            expandedRowRender,
                            expandRowByClick: true,
                        }}
                    />
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
