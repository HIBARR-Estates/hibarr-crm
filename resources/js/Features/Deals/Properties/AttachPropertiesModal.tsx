import React, { useState, useCallback, useMemo } from "react";
import {
    Modal,
    Tabs,
    Select,
    Button,
    List,
    Tag,
    Empty,
    InputNumber,
    Card,
    Space,
    Spin,
    Typography,
    Popconfirm,
    Divider,
} from "antd";
import {
    PlusOutlined,
    DeleteOutlined,
    HomeOutlined,
    EnvironmentOutlined,
    DollarOutlined,
    SearchOutlined,
    LinkOutlined,
    ExportOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import { useApiMutate } from "@/lib/api/client";
import type { ApiSuccessResponse } from "@/lib/api/types";
import { generatePropertySubtitle } from "@/lib/utils";
import type { Deal } from "@/Types/api/deals";
import type {
    AttachedProperty,
    AttachPropertyPayload,
    PropertySearchResult,
    ProjectUnitTypesResponse,
} from "@/Types/api/deal-properties";
import type { DeveloperProjectUnitType } from "@/Types/developerProject";

const { Text } = Typography;

// ── Constants for select options ──────────────────────────────────
const VIEW_TYPE_OPTIONS = [
    { value: "sea_front", label: "Sea Front (Direct)" },
    { value: "sea_view", label: "Sea View" },
    { value: "mountain_view", label: "Mountain View" },
    { value: "pool_view", label: "Pool View" },
    { value: "garden_view", label: "Garden View" },
    { value: "city_view", label: "City View" },
];

const OUTSIDE_FEATURE_OPTIONS = [
    { value: "barbeque", label: "Barbeque" },
    { value: "bounding_wall", label: "Bounding Wall" },
    { value: "double_glazing", label: "Double Glazing" },
    { value: "garage", label: "Garage" },
    { value: "garden", label: "Garden" },
    { value: "generator", label: "Generator" },
    { value: "lift", label: "Lift" },
    { value: "private_pool", label: "Private Pool" },
    { value: "terrace", label: "Terrace" },
    { value: "thermal_insulation", label: "Thermal Insulation" },
    { value: "water_tank", label: "Water Tank" },
    { value: "jacuzzi", label: "Jacuzzi" },
];

const INSIDE_FEATURE_OPTIONS = [
    { value: "air_condition", label: "Air Condition" },
    { value: "bath_tube", label: "Bath Tube" },
    { value: "blind", label: "Blind" },
    { value: "ceramic", label: "Ceramic" },
    { value: "closet", label: "Closet" },
    { value: "entryphone", label: "Entryphone" },
    { value: "fire_alarm", label: "Fire Alarm" },
    { value: "fireplace", label: "Fireplace" },
    { value: "laundry", label: "Laundry" },
    { value: "master_room_bath", label: "Master Room Bath" },
    { value: "panel_door", label: "Panel Door" },
    { value: "pantry", label: "Pantry" },
    { value: "parquet", label: "Parquet" },
    { value: "solar_electric", label: "Solar Electric" },
    { value: "steel_door", label: "Steel Door" },
    { value: "tv_infrastructure", label: "TV Infrastructure" },
    { value: "wallpaper", label: "Wallpaper" },
    { value: "water_booster", label: "Water Booster" },
];

const FLOOR_OPTIONS = [
    { value: "basement", label: "Basement (-1)" },
    { value: "ground", label: "Ground Floor (0)" },
    { value: "1", label: "1st Floor" },
    { value: "2", label: "2nd Floor" },
    { value: "3", label: "3rd Floor" },
    { value: "4", label: "4th Floor" },
    { value: "5", label: "5th Floor" },
    { value: "6", label: "6th Floor" },
    { value: "7", label: "7th Floor" },
    { value: "8", label: "8th Floor" },
    { value: "9", label: "9th Floor" },
    { value: "10", label: "10th Floor" },
    { value: "11", label: "11th Floor" },
    { value: "12", label: "12th Floor" },
    { value: "13", label: "13th Floor" },
    { value: "14", label: "14th Floor" },
    { value: "15+", label: "15th Floor+" },
];

const SALE_TYPE_COLORS: Record<string, string> = {
    "For Sale": "green",
    "For Rent": "blue",
    "For Daily Rental": "orange",
};

const STATUS_COLORS: Record<string, string> = {
    available: "green",
    "under offer": "orange",
    sold: "red",
    withdrawn: "default",
    reserved: "purple",
    rented: "blue",
};

// ── Props ─────────────────────────────────────────────────────────
interface ManageDealPropertiesModalProps {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    onRefresh: () => void;
}

// ── Component ─────────────────────────────────────────────────────
const ManageDealPropertiesModal: React.FC<ManageDealPropertiesModalProps> = ({
    open,
    onClose,
    deal,
    onRefresh,
}) => {
    // ── State ─────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [propertySelectOpened, setPropertySelectOpened] = useState(false);
    const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(
        null,
    );
    const [selectedProjectId, setSelectedProjectId] = useState<
        number | undefined
    >();
    const [expandedUnitTypeId, setExpandedUnitTypeId] = useState<number | null>(
        null,
    );
    const [unitTypeOverrides, setUnitTypeOverrides] = useState<
        Record<string, any>
    >({});

    // ── Fetch attached properties ─────────────────────────────────
    const {
        data: attachedData,
        isLoading: loadingAttached,
        refetch: refetchAttached,
    } = useApiQuery<ApiSuccessResponse<AttachedProperty[]>>({
        path: route("deals.properties.index", deal.id),
        options: { enabled: open },
    });

    const attachedProperties = attachedData?.data ?? [];

    // ── Property search ───────────────────────────────────────────
    const { data: searchData, isLoading: searching } = useApiQuery<
        ApiSuccessResponse<PropertySearchResult[]>
    >({
        path: route("deals.properties.search"),
        params: searchQuery.trim() ? { q: searchQuery } : undefined,
        options: { enabled: open && propertySelectOpened },
    });

    const searchResults = searchData?.data ?? [];
    const attachedPropertyIds = useMemo(
        () =>
            new Set(
                attachedProperties.map((p) => p.property?.id).filter(Boolean),
            ),
        [attachedProperties],
    );
    const filteredResults = searchResults.filter(
        (p) => !attachedPropertyIds.has(p.id),
    );

    // ── Project unit types ────────────────────────────────────────
    const { data: unitTypesData, isLoading: loadingUnitTypes } =
        useApiQuery<ProjectUnitTypesResponse>({
            path: route("deals.properties.unit_types", selectedProjectId || 0),
            options: { enabled: !!selectedProjectId },
        });

    const unitTypes = unitTypesData?.data ?? [];
    const projectInfo = unitTypesData?.project;

    // ── Fetch projects for dropdown ───────────────────────────────
    const { data: projectsData, isLoading: loadingProjects } = useApiQuery<{
        data: Array<{ id: number; name: string; developer?: { name: string } }>;
    }>({
        path: route("form-data.index", "developer_projects"),
        params: { per_page: 100 },
        options: { enabled: open },
    });

    const projects = projectsData?.data ?? [];

    // ── Mutations ─────────────────────────────────────────────────
    const handleRefresh = useCallback(() => {
        refetchAttached();
        onRefresh();
    }, [refetchAttached, onRefresh]);

    const { mutate: attachProperty, isPending: attaching } = useApiMutate<
        AttachPropertyPayload,
        any,
        ApiSuccessResponse
    >(route("deals.properties.store", deal.id), "POST", handleRefresh);

    // ── Handlers ──────────────────────────────────────────────────
    const handleAttachExisting = () => {
        if (!selectedPropertyId) return;
        attachProperty({ property_id: selectedPropertyId });
        setSelectedPropertyId(null);
        setSearchQuery("");
    };

    const handleDetach = async (productId: number) => {
        try {
            const res = await fetch(
                route("deals.properties.destroy", [deal.id, productId]),
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                        "X-CSRF-TOKEN":
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute("content") ?? "",
                        Accept: "application/json",
                    },
                },
            );
            if (res.ok) {
                handleRefresh();
            }
        } catch {
            // error handled by notification
        }
    };

    const handleAddFromUnitType = (unitType: DeveloperProjectUnitType) => {
        const overrides = unitTypeOverrides[unitType.id] ?? {};
        attachProperty({
            unit_type_id: unitType.id,
            price: overrides.price ?? unitType.starting_price,
            floor_number: overrides.floor_number ?? unitType.floor,
            view_types: overrides.view_types ?? unitType.view_types,
            outside_features:
                overrides.outside_features ?? unitType.outside_features,
            inside_features:
                overrides.inside_features ?? unitType.inside_features,
        });
        setExpandedUnitTypeId(null);
        setUnitTypeOverrides((prev) => {
            const next = { ...prev };
            delete next[unitType.id];
            return next;
        });
    };

    const updateOverride = (unitTypeId: number, field: string, value: any) => {
        setUnitTypeOverrides((prev) => ({
            ...prev,
            [unitTypeId]: { ...prev[unitTypeId], [field]: value },
        }));
    };

    const formatPrice = (price: any) => {
        const num = typeof price === "object" ? price?.amount : price;
        if (!num || Number(num) === 0) return null;
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
        }).format(Number(num));
    };

    const formatFeatures = (label: string) =>
        label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // ── Render ────────────────────────────────────────────────────
    return (
        <Modal
            open={open}
            onCancel={onClose}
            title="Manage Deal Properties"
            width={900}
            footer={null}
            destroyOnClose
            maskClosable={false}
        >
            <div className="flex flex-col gap-y-6">
                {/* ── Add Property Section ───────────────── */}
                <Card size="small" className="border-gray-200">
                    <Tabs
                        size="small"
                        items={[
                            {
                                key: "search",
                                label: (
                                    <span>
                                        <SearchOutlined className="mr-1.5" />
                                        Search Properties
                                    </span>
                                ),
                                children: (
                                    <div className="flex flex-col gap-y-3">
                                        <div className="flex items-center gap-3">
                                            <Select
                                                className="flex-1"
                                                showSearch
                                                placeholder="Search approved properties by name, city, area..."
                                                filterOption={false}
                                                onFocus={() =>
                                                    setPropertySelectOpened(
                                                        true,
                                                    )
                                                }
                                                onSearch={setSearchQuery}
                                                value={selectedPropertyId}
                                                onChange={setSelectedPropertyId}
                                                loading={searching}
                                                notFoundContent={
                                                    searching ? (
                                                        <Spin size="small" />
                                                    ) : (
                                                        <Text
                                                            type="secondary"
                                                            className="text-xs"
                                                        >
                                                            No properties found
                                                        </Text>
                                                    )
                                                }
                                                options={filteredResults.map(
                                                    (p) => ({
                                                        value: p.id,
                                                        label: (
                                                            <div className="flex items-center justify-between py-0.5">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="font-medium text-sm">
                                                                        {generatePropertySubtitle(
                                                                            p,
                                                                        ) ||
                                                                            p.title ||
                                                                            `Property #${p.id}`}
                                                                    </span>
                                                                    <div className="text-xs text-gray-400 truncate">
                                                                        {[
                                                                            p.property_type?.replace(
                                                                                /_/g,
                                                                                " ",
                                                                            ),
                                                                            p.city,
                                                                        ]
                                                                            .filter(
                                                                                Boolean,
                                                                            )
                                                                            .join(
                                                                                " · ",
                                                                            )}
                                                                    </div>
                                                                </div>
                                                                {p.sale_type && (
                                                                    <Tag
                                                                        color={
                                                                            SALE_TYPE_COLORS[
                                                                                p
                                                                                    .sale_type
                                                                            ] ??
                                                                            "default"
                                                                        }
                                                                        className="!text-[10px] ml-2 shrink-0"
                                                                    >
                                                                        {
                                                                            p.sale_type
                                                                        }
                                                                    </Tag>
                                                                )}
                                                            </div>
                                                        ),
                                                    }),
                                                )}
                                                allowClear
                                            />
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={handleAttachExisting}
                                                loading={attaching}
                                                disabled={!selectedPropertyId}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: "project",
                                label: (
                                    <span>
                                        <HomeOutlined className="mr-1.5" />
                                        From Project
                                    </span>
                                ),
                                children: (
                                    <div className="flex flex-col gap-y-4">
                                        {/* Project selector */}
                                        <div className="flex flex-col gap-y-2">
                                            <Select
                                                className="w-full"
                                                showSearch
                                                placeholder="Select a project..."
                                                filterOption={(input, option) =>
                                                    (option?.label ?? "")
                                                        .toString()
                                                        .toLowerCase()
                                                        .includes(
                                                            input.toLowerCase(),
                                                        )
                                                }
                                                loading={loadingProjects}
                                                options={projects.map((p) => ({
                                                    value: p.id,
                                                    label: `${p.name}${p.developer ? ` (${p.developer.name})` : ""}`,
                                                }))}
                                                value={selectedProjectId}
                                                onChange={(val) => {
                                                    setSelectedProjectId(val);
                                                    setExpandedUnitTypeId(null);
                                                    setUnitTypeOverrides({});
                                                }}
                                                allowClear
                                                onClear={() =>
                                                    setSelectedProjectId(
                                                        undefined,
                                                    )
                                                }
                                            />

                                            {/* Availability link */}
                                            {projectInfo?.availability_link && (
                                                <a
                                                    href={
                                                        projectInfo.availability_link
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    <ExportOutlined />
                                                    Check Availability
                                                </a>
                                            )}
                                            {projectInfo &&
                                                !projectInfo?.availability_link && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                        <LinkOutlined />
                                                        No availability info
                                                    </span>
                                                )}
                                            {/* Google drive link */}
                                            {projectInfo?.google_drive_link && (
                                                <a
                                                    href={
                                                        projectInfo.google_drive_link
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    <ExportOutlined />
                                                    Google Drive Info
                                                </a>
                                            )}
                                            {projectInfo &&
                                                !projectInfo?.google_drive_link && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                        <LinkOutlined />
                                                        No google drive info
                                                    </span>
                                                )}
                                        </div>

                                        {/* Unit types list */}
                                        {selectedProjectId && (
                                            <div>
                                                {loadingUnitTypes ? (
                                                    <div className="py-6 flex justify-center">
                                                        <Spin />
                                                    </div>
                                                ) : unitTypes.length === 0 ? (
                                                    <Empty
                                                        description="No unit types for this project"
                                                        image={
                                                            Empty.PRESENTED_IMAGE_SIMPLE
                                                        }
                                                        className="my-4"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col gap-y-2">
                                                        {unitTypes.map((ut) => (
                                                            <UnitTypeCard
                                                                key={ut.id}
                                                                unitType={ut}
                                                                expanded={
                                                                    expandedUnitTypeId ===
                                                                    ut.id
                                                                }
                                                                onToggle={() =>
                                                                    setExpandedUnitTypeId(
                                                                        expandedUnitTypeId ===
                                                                            ut.id
                                                                            ? null
                                                                            : ut.id,
                                                                    )
                                                                }
                                                                overrides={
                                                                    unitTypeOverrides[
                                                                        ut.id
                                                                    ] ?? {}
                                                                }
                                                                onOverrideChange={(
                                                                    field,
                                                                    val,
                                                                ) =>
                                                                    updateOverride(
                                                                        ut.id,
                                                                        field,
                                                                        val,
                                                                    )
                                                                }
                                                                onAdd={() =>
                                                                    handleAddFromUnitType(
                                                                        ut,
                                                                    )
                                                                }
                                                                adding={
                                                                    attaching
                                                                }
                                                                formatPrice={
                                                                    formatPrice
                                                                }
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </Card>

                {/* ── Attached Properties List ──────────────── */}
                <div>
                    <div className="mb-3">
                        <Text strong className="text-sm">
                            Attached Properties
                        </Text>
                        <Text type="secondary" className="ml-2 text-xs">
                            ({attachedProperties.length})
                        </Text>
                    </div>

                    {loadingAttached ? (
                        <div className="py-8 flex justify-center">
                            <Spin />
                        </div>
                    ) : attachedProperties.length === 0 ? (
                        <Empty
                            description="No properties attached to this deal"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            className="my-6"
                        />
                    ) : (
                        <List
                            size="small"
                            dataSource={attachedProperties}
                            renderItem={(item) => {
                                const prop = item.property;
                                const photo = prop?.photos?.[0];
                                const saleType = prop?.sale_type;
                                const project = prop?.developer_project;
                                const statusKey =
                                    prop?.status?.toLowerCase() ?? "";

                                return (
                                    <List.Item
                                        key={item.product_id}
                                        className="!px-0"
                                        actions={[
                                            <Popconfirm
                                                key="remove"
                                                title="Remove this property from the deal?"
                                                onConfirm={() =>
                                                    handleDetach(
                                                        item.product_id,
                                                    )
                                                }
                                                okText="Remove"
                                                cancelText="Cancel"
                                                okButtonProps={{
                                                    danger: true,
                                                }}
                                            >
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                />
                                            </Popconfirm>,
                                        ]}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {/* Thumbnail */}
                                            <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                                {photo ? (
                                                    <img
                                                        src={photo}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <HomeOutlined className="text-gray-300 text-lg" />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="min-w-0 flex-1 flex flex-col gap-y-1">
                                                {/* Title row */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {prop ? (
                                                        <a
                                                            href={route(
                                                                "properties.show",
                                                                { id: prop.id },
                                                            )}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 truncate"
                                                        >
                                                            {generatePropertySubtitle(
                                                                prop,
                                                            ) ||
                                                                prop.title ||
                                                                item.product_name}
                                                        </a>
                                                    ) : (
                                                        <span className="text-sm font-semibold text-gray-800 truncate">
                                                            {item.product_name}
                                                        </span>
                                                    )}

                                                    {/* Sale type - always prominent */}
                                                    {saleType && (
                                                        <Tag
                                                            color={
                                                                SALE_TYPE_COLORS[
                                                                    saleType
                                                                ] ?? "default"
                                                            }
                                                            className="!text-xs font-semibold"
                                                        >
                                                            {saleType}
                                                        </Tag>
                                                    )}

                                                    {/* Project badge */}
                                                    {project && (
                                                        <Tag
                                                            color="geekblue"
                                                            className="!text-[10px]"
                                                        >
                                                            {project.name}
                                                        </Tag>
                                                    )}

                                                    {/* Status */}
                                                    {prop?.status && (
                                                        <Tag
                                                            color={
                                                                STATUS_COLORS[
                                                                    statusKey
                                                                ] ?? "default"
                                                            }
                                                            className="!text-[10px] capitalize"
                                                        >
                                                            {prop.status}
                                                        </Tag>
                                                    )}
                                                </div>

                                                {/* Details row */}
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    {prop?.property_type && (
                                                        <span className="capitalize">
                                                            {prop.property_type.replace(
                                                                /_/g,
                                                                " ",
                                                            )}
                                                        </span>
                                                    )}
                                                    {(prop?.city ||
                                                        prop?.area) && (
                                                        <span className="flex items-center gap-1">
                                                            <EnvironmentOutlined className="text-[10px]" />
                                                            {[
                                                                prop.area,
                                                                prop.city,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(", ")}
                                                        </span>
                                                    )}
                                                    {prop?.bedrooms && (
                                                        <span>
                                                            {prop.bedrooms} Beds
                                                        </span>
                                                    )}
                                                    {prop?.bathrooms && (
                                                        <span>
                                                            {prop.bathrooms}{" "}
                                                            Baths
                                                        </span>
                                                    )}
                                                    {formatPrice(
                                                        prop?.price,
                                                    ) && (
                                                        <span className="font-semibold text-blue-600">
                                                            {formatPrice(
                                                                prop?.price,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    )}
                </div>
            </div>
        </Modal>
    );
};

// ── UnitTypeCard sub-component ────────────────────────────────────
interface UnitTypeCardProps {
    unitType: DeveloperProjectUnitType;
    expanded: boolean;
    onToggle: () => void;
    overrides: Record<string, any>;
    onOverrideChange: (field: string, value: any) => void;
    onAdd: () => void;
    adding: boolean;
    formatPrice: (price: any) => string | null;
}

const UnitTypeCard: React.FC<UnitTypeCardProps> = ({
    unitType,
    expanded,
    onToggle,
    overrides,
    onOverrideChange,
    onAdd,
    adding,
    formatPrice,
}) => {
    const priceValue = overrides.price ?? unitType.starting_price;
    const floorValue = overrides.floor_number ?? unitType.floor;
    const viewTypesValue = overrides.view_types ?? unitType.view_types ?? [];
    const outsideValue =
        overrides.outside_features ?? unitType.outside_features ?? [];
    const insideValue =
        overrides.inside_features ?? unitType.inside_features ?? [];

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden transition-shadow hover:shadow-sm">
            {/* Summary row - always visible */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-gray-50/50 transition cursor-pointer text-left"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 capitalize">
                                {unitType.property_type?.replace(/_/g, " ") ??
                                    "Unit Type"}
                            </span>
                            {unitType.reference_code && (
                                <Tag className="!text-[10px]">
                                    {unitType.reference_code}
                                </Tag>
                            )}
                        </div>
                        <div className="flex items-center gap-2.5 mt-0.5 text-xs text-gray-500">
                            {unitType.bedrooms != null && (
                                <span>{unitType.bedrooms} Beds</span>
                            )}
                            {unitType.bathrooms != null && (
                                <span>{unitType.bathrooms} Baths</span>
                            )}
                            {unitType.floor && (
                                <span>Floor: {unitType.floor}</span>
                            )}
                            {unitType.total_area_sqm && (
                                <span>{unitType.total_area_sqm} m²</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {unitType.starting_price != null && (
                        <span className="text-sm font-semibold text-blue-600">
                            {formatPrice(unitType.starting_price) ??
                                `${unitType.currency ?? ""} ${unitType.starting_price}`}
                        </span>
                    )}
                    <span
                        className={`text-gray-400 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}
                    >
                        ▾
                    </span>
                </div>
            </button>

            {/* Expanded edit form */}
            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/30 flex flex-col gap-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Price */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Price
                            </label>
                            <InputNumber
                                className="w-full"
                                size="small"
                                min={0}
                                value={priceValue}
                                onChange={(val) =>
                                    onOverrideChange("price", val)
                                }
                                formatter={(val) =>
                                    `${val}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
                                    )
                                }
                                parser={(val) =>
                                    Number(val?.replace(/,/g, "") ?? 0)
                                }
                            />
                        </div>

                        {/* Floor */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Floor
                            </label>
                            <Select
                                className="w-full"
                                size="small"
                                value={floorValue}
                                onChange={(val) =>
                                    onOverrideChange("floor_number", val)
                                }
                                options={FLOOR_OPTIONS}
                                allowClear
                                placeholder="Select floor"
                            />
                        </div>
                    </div>

                    {/* View Types */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            View Types
                        </label>
                        <Select
                            className="w-full"
                            size="small"
                            mode="multiple"
                            value={viewTypesValue}
                            onChange={(val) =>
                                onOverrideChange("view_types", val)
                            }
                            options={VIEW_TYPE_OPTIONS}
                            placeholder="Select view types"
                        />
                    </div>

                    {/* Outside Features */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Outside Features
                        </label>
                        <Select
                            className="w-full"
                            size="small"
                            mode="multiple"
                            value={outsideValue}
                            onChange={(val) =>
                                onOverrideChange("outside_features", val)
                            }
                            options={OUTSIDE_FEATURE_OPTIONS}
                            placeholder="Select outside features"
                        />
                    </div>

                    {/* Inside Features */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Inside Features
                        </label>
                        <Select
                            className="w-full"
                            size="small"
                            mode="multiple"
                            value={insideValue}
                            onChange={(val) =>
                                onOverrideChange("inside_features", val)
                            }
                            options={INSIDE_FEATURE_OPTIONS}
                            placeholder="Select inside features"
                        />
                    </div>

                    <Divider className="!my-2" />

                    <div className="flex justify-end">
                        <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={onAdd}
                            loading={adding}
                        >
                            Add to Deal
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageDealPropertiesModal;
