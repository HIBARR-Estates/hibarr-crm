import React from "react";
import {
    Card,
    Row,
    Col,
    Descriptions,
    Tag,
    Image,
    Typography,
    Empty,
    Button,
} from "antd";
import {
    CameraOutlined,
    ExpandOutlined,
    HomeOutlined,
    ColumnHeightOutlined,
    EnvironmentOutlined,
    InfoCircleOutlined,
    AppstoreOutlined,
    ToolOutlined,
    BankOutlined,
    DollarOutlined,
    FileTextOutlined,
} from "@ant-design/icons";

import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import UnitTypePropertyHeader from "./UnitTypePropertyHeader";
// import UnitTypePropertyHeader from "./UnitTypePropertyHeader";

const { Text, Paragraph } = Typography;

interface MergedAsset {
    id: number | string;
    url: string;
    name: string | null;
    asset_type: string;
    tags: string[];
    source: "unit_type" | "project";
    order: number;
}

interface UnitTypePropertyViewProps {
    unitType: DeveloperProjectUnitType;
    developerProject: DeveloperProject;
    mergedAssets: MergedAsset[];
    soldCount: number;
    soldPropertyIds: number[];
    onCheckAvailability: () => void;
    onMarkAsSold: () => void;
}

// ─── Gallery Section ───
function UnitTypeGallery({ assets }: { assets: MergedAsset[] }) {
    const imageAssets = assets.filter((a) => a.asset_type === "image");
    const images = imageAssets.map((a) => a.url).filter(Boolean);

    if (images.length === 0) {
        return (
            <div className="relative rounded-xl bg-gray-50 border border-gray-200 h-80 flex items-center justify-center mb-6">
                <div className="text-center text-gray-400">
                    <CameraOutlined className="text-5xl mb-3" />
                    <p className="text-base">No photos available</p>
                </div>
            </div>
        );
    }

    const getTag = (index: number) => {
        const asset = imageAssets[index];
        if (asset?.tags && asset.tags.length > 0) {
            return asset.tags[0];
        }
        return null;
    };

    const heroImage = images[0];
    const sideImages = images.slice(1, 5);
    const remainingCount = images.length - 5;

    return (
        <div className="relative mb-6">
            <Image.PreviewGroup items={images}>
                <div className="grid grid-cols-4 grid-rows-2 gap-1.5 rounded-xl overflow-hidden h-[420px]">
                    {/* Hero image */}
                    <div className="col-span-2 row-span-2 relative group cursor-pointer">
                        <Image
                            src={heroImage}
                            alt="Unit type photo"
                            className="object-cover w-full h-full"
                            style={{ height: "100%", width: "100%" }}
                            preview={{
                                mask: (
                                    <div className="flex items-center gap-2">
                                        <ExpandOutlined />
                                        <span>View</span>
                                    </div>
                                ),
                            }}
                        />
                        {getTag(0) && (
                            <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {getTag(0)}
                            </span>
                        )}
                    </div>

                    {/* Side images */}
                    {sideImages.map((img, i) => (
                        <div key={i} className="relative group cursor-pointer">
                            <Image
                                src={img}
                                alt={`Unit type photo ${i + 2}`}
                                className="object-cover w-full h-full"
                                style={{ height: "100%", width: "100%" }}
                                preview={{
                                    mask: (
                                        <div className="flex items-center gap-2">
                                            <ExpandOutlined />
                                        </div>
                                    ),
                                }}
                            />
                            {getTag(i + 1) && (
                                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                                    {getTag(i + 1)}
                                </span>
                            )}
                            {i === sideImages.length - 1 &&
                                remainingCount > 0 && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                        <Text className="text-white text-lg font-semibold">
                                            +{remainingCount} more
                                        </Text>
                                    </div>
                                )}
                        </div>
                    ))}

                    {/* Empty slots */}
                    {Array.from({
                        length: Math.max(0, 4 - sideImages.length),
                    }).map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="bg-gray-100 flex items-center justify-center"
                        >
                            <CameraOutlined className="text-gray-300 text-xl" />
                        </div>
                    ))}
                </div>
            </Image.PreviewGroup>

            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                    <CameraOutlined className="mr-1" />
                    {images.length} {images.length === 1 ? "photo" : "photos"}
                </span>
            </div>
        </div>
    );
}

// ─── Stat Block (reusable) ───
function StatBlock({
    label,
    value,
    icon,
}: {
    label: string;
    value: string | number | React.ReactNode;
    icon: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-gray-400 text-lg">{icon}</div>
            <div>
                <div className="text-xs text-gray-500">{label}</div>
                <div className="font-semibold text-gray-900 text-sm">
                    {value}
                </div>
            </div>
        </div>
    );
}

// ─── Helper to format features ───
function FeatureTags({ features }: { features: string[] | null | undefined }) {
    if (!features || features.length === 0)
        return <Text type="secondary">—</Text>;
    return (
        <div className="flex flex-wrap gap-1">
            {features.map((f) => (
                <Tag key={f} className="capitalize">
                    {f.replace(/_/g, " ")}
                </Tag>
            ))}
        </div>
    );
}

export default function UnitTypePropertyView({
    unitType,
    developerProject,
    mergedAssets,
    soldCount,
    soldPropertyIds,
    onCheckAvailability,
    onMarkAsSold,
}: UnitTypePropertyViewProps) {
    const location = developerProject.location;

    return (
        <div className="unit-type-property-view">
            {/* Header */}
            <UnitTypePropertyHeader
                unitType={unitType}
                developerProject={developerProject}
                soldCount={soldCount}
                soldPropertyIds={soldPropertyIds}
                onCheckAvailability={onCheckAvailability}
                onMarkAsSold={onMarkAsSold}
            />

            {/* Photo Gallery */}
            <UnitTypeGallery assets={mergedAssets} />

            <Row gutter={[24, 16]}>
                {/* ─── Main Content ─── */}
                <Col xs={24} lg={16}>
                    <div className="flex flex-col gap-4">
                        {/* Core Details */}
                        <Card
                            title={
                                <span>
                                    <AppstoreOutlined className="mr-2" />
                                    Core Details
                                </span>
                            }
                            variant="outlined"
                            size="small"
                        >
                            <Descriptions
                                column={{ xs: 1, sm: 2, md: 3 }}
                                size="small"
                            >
                                <Descriptions.Item label="Category">
                                    <Tag color="blue" className="capitalize">
                                        {unitType.primary_category}
                                    </Tag>
                                </Descriptions.Item>
                                {unitType.property_type && (
                                    <Descriptions.Item label="Property Type">
                                        <span className="capitalize">
                                            {unitType.property_type.replace(
                                                /_/g,
                                                " ",
                                            )}
                                        </span>
                                    </Descriptions.Item>
                                )}
                                {unitType.unit_style &&
                                    unitType.unit_style.length > 0 && (
                                        <Descriptions.Item label="Unit Style">
                                            {unitType.unit_style.map((s) => (
                                                <Tag
                                                    key={s}
                                                    className="capitalize"
                                                >
                                                    {s.replace(/_/g, " ")}
                                                </Tag>
                                            ))}
                                        </Descriptions.Item>
                                    )}
                                {unitType.furniture_status && (
                                    <Descriptions.Item label="Furniture Status">
                                        <span className="capitalize">
                                            {unitType.furniture_status.replace(
                                                /_/g,
                                                " ",
                                            )}
                                        </span>
                                    </Descriptions.Item>
                                )}
                                {unitType.view_types &&
                                    unitType.view_types.length > 0 && (
                                        <Descriptions.Item label="View Types">
                                            {unitType.view_types.map((v) => (
                                                <Tag
                                                    key={v}
                                                    color="cyan"
                                                    className="capitalize"
                                                >
                                                    {v.replace(/_/g, " ")}
                                                </Tag>
                                            ))}
                                        </Descriptions.Item>
                                    )}
                                {unitType.completion_date && (
                                    <Descriptions.Item label="Completion Date">
                                        {unitType.completion_date}
                                    </Descriptions.Item>
                                )}
                                {unitType.military_base_distance_km != null && (
                                    <Descriptions.Item label="Military Base Distance">
                                        {unitType.military_base_distance_km} km
                                    </Descriptions.Item>
                                )}
                                {unitType.has_restrictions && (
                                    <Descriptions.Item label="Restrictions">
                                        <Tag color="red">Has Restrictions</Tag>
                                        {unitType.restriction_notes && (
                                            <span className="ml-1 text-xs text-gray-500">
                                                {unitType.restriction_notes}
                                            </span>
                                        )}
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        </Card>

                        {/* Specifications */}
                        <Card
                            title={
                                <span>
                                    <ColumnHeightOutlined className="mr-2" />
                                    Specifications
                                </span>
                            }
                            variant="outlined"
                            size="small"
                        >
                            <Row gutter={[12, 12]}>
                                {unitType.bedrooms !== null &&
                                    unitType.bedrooms !== undefined && (
                                        <Col xs={12} sm={8} md={6}>
                                            <StatBlock
                                                label="Bedrooms"
                                                value={
                                                    unitType.bedrooms === 0
                                                        ? "Studio"
                                                        : unitType.bedrooms
                                                }
                                                icon={<HomeOutlined />}
                                            />
                                        </Col>
                                    )}
                                {unitType.bathrooms !== null &&
                                    unitType.bathrooms !== undefined && (
                                        <Col xs={12} sm={8} md={6}>
                                            <StatBlock
                                                label="Bathrooms"
                                                value={unitType.bathrooms}
                                                icon={<HomeOutlined />}
                                            />
                                        </Col>
                                    )}
                                {unitType.floor && (
                                    <Col xs={12} sm={8} md={6}>
                                        <StatBlock
                                            label="Floor"
                                            value={unitType.floor}
                                            icon={<ColumnHeightOutlined />}
                                        />
                                    </Col>
                                )}
                                {unitType.floors_in_building != null && (
                                    <Col xs={12} sm={8} md={6}>
                                        <StatBlock
                                            label="Floors in Building"
                                            value={unitType.floors_in_building}
                                            icon={<ColumnHeightOutlined />}
                                        />
                                    </Col>
                                )}
                                {unitType.total_area_sqm != null && (
                                    <Col xs={12} sm={8} md={6}>
                                        <StatBlock
                                            label="Total Area"
                                            value={`${unitType.total_area_sqm} m²`}
                                            icon={<ExpandOutlined />}
                                        />
                                    </Col>
                                )}
                                {unitType.living_area_sqm != null && (
                                    <Col xs={12} sm={8} md={6}>
                                        <StatBlock
                                            label="Living Area"
                                            value={`${unitType.living_area_sqm} m²`}
                                            icon={<ExpandOutlined />}
                                        />
                                    </Col>
                                )}
                                {unitType.terrace_balcony_sqm != null && (
                                    <Col xs={12} sm={8} md={6}>
                                        <StatBlock
                                            label="Terrace/Balcony"
                                            value={`${unitType.terrace_balcony_sqm} m²`}
                                            icon={<ExpandOutlined />}
                                        />
                                    </Col>
                                )}
                                {unitType.plot_size_sqm != null && (
                                    <Col xs={12} sm={8} md={6}>
                                        <StatBlock
                                            label="Plot Size"
                                            value={`${unitType.plot_size_sqm} m²`}
                                            icon={<ExpandOutlined />}
                                        />
                                    </Col>
                                )}
                            </Row>
                        </Card>

                        {/* Features */}
                        {((unitType.outside_features &&
                            unitType.outside_features.length > 0) ||
                            (unitType.inside_features &&
                                unitType.inside_features.length > 0)) && (
                            <Card
                                title={
                                    <span>
                                        <ToolOutlined className="mr-2" />
                                        Features
                                    </span>
                                }
                                variant="outlined"
                                size="small"
                            >
                                {unitType.outside_features &&
                                    unitType.outside_features.length > 0 && (
                                        <div className="mb-3">
                                            <Text
                                                strong
                                                className="text-xs text-gray-500 uppercase tracking-wide"
                                            >
                                                Exterior Features
                                            </Text>
                                            <div className="mt-1">
                                                <FeatureTags
                                                    features={
                                                        unitType.outside_features
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                {unitType.inside_features &&
                                    unitType.inside_features.length > 0 && (
                                        <div>
                                            <Text
                                                strong
                                                className="text-xs text-gray-500 uppercase tracking-wide"
                                            >
                                                Interior Features
                                            </Text>
                                            <div className="mt-1">
                                                <FeatureTags
                                                    features={
                                                        unitType.inside_features
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                            </Card>
                        )}

                        {/* Description */}
                        {unitType.description && (
                            <Card
                                title={
                                    <span>
                                        <FileTextOutlined className="mr-2" />
                                        Description
                                    </span>
                                }
                                variant="outlined"
                                size="small"
                            >
                                <Paragraph className="text-gray-700 whitespace-pre-wrap mb-0">
                                    {unitType.description}
                                </Paragraph>
                            </Card>
                        )}

                        {/* Developer Project Info */}
                        <Card
                            title={
                                <span>
                                    <BankOutlined className="mr-2" />
                                    Developer Project
                                </span>
                            }
                            variant="outlined"
                            size="small"
                        >
                            <Descriptions
                                column={{ xs: 1, sm: 2 }}
                                size="small"
                            >
                                <Descriptions.Item label="Project Name">
                                    {developerProject.name}
                                </Descriptions.Item>
                                {developerProject.developer && (
                                    <Descriptions.Item label="Developer">
                                        {developerProject.developer.name}
                                    </Descriptions.Item>
                                )}
                                {developerProject.construction_status && (
                                    <Descriptions.Item label="Construction Status">
                                        <Tag
                                            color="orange"
                                            className="capitalize"
                                        >
                                            {developerProject.construction_status.replace(
                                                /_/g,
                                                " ",
                                            )}
                                        </Tag>
                                    </Descriptions.Item>
                                )}
                                {developerProject.number_of_units != null && (
                                    <Descriptions.Item label="Total Units">
                                        {developerProject.number_of_units}
                                    </Descriptions.Item>
                                )}
                                {developerProject.number_of_blocks != null && (
                                    <Descriptions.Item label="Blocks">
                                        {developerProject.number_of_blocks}
                                    </Descriptions.Item>
                                )}
                                {developerProject.completion_date && (
                                    <Descriptions.Item label="Project Completion">
                                        {developerProject.completion_date}
                                    </Descriptions.Item>
                                )}
                                {developerProject.title_deed_type && (
                                    <Descriptions.Item label="Title Deed Type">
                                        <span className="capitalize">
                                            {developerProject.title_deed_type.replace(
                                                /_/g,
                                                " ",
                                            )}
                                        </span>
                                    </Descriptions.Item>
                                )}
                                {developerProject.furniture_package && (
                                    <Descriptions.Item label="Furniture Package">
                                        <span className="capitalize">
                                            {developerProject.furniture_package.replace(
                                                /_/g,
                                                " ",
                                            )}
                                        </span>
                                    </Descriptions.Item>
                                )}
                            </Descriptions>

                            {/* Facilities */}
                            {developerProject.facilities &&
                                developerProject.facilities.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <Text
                                            strong
                                            className="text-xs text-gray-500 uppercase tracking-wide"
                                        >
                                            Facilities
                                        </Text>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {developerProject.facilities.map(
                                                (f) => (
                                                    <Tag
                                                        key={f}
                                                        color="green"
                                                        className="capitalize"
                                                    >
                                                        {f.replace(/_/g, " ")}
                                                    </Tag>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                )}

                            {/* Payment Plan */}
                            {developerProject.payment_plan?.enabled && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <Text
                                        strong
                                        className="text-xs text-gray-500 uppercase tracking-wide"
                                    >
                                        <DollarOutlined className="mr-1" />
                                        Payment Plan
                                    </Text>
                                    <Descriptions
                                        column={2}
                                        size="small"
                                        className="mt-1"
                                    >
                                        {developerProject.payment_plan
                                            .downpayment_value != null && (
                                            <Descriptions.Item label="Down Payment">
                                                {
                                                    developerProject
                                                        .payment_plan
                                                        .downpayment_value
                                                }
                                                {developerProject.payment_plan
                                                    .downpayment_type ===
                                                "percentage"
                                                    ? "%"
                                                    : " (fixed)"}
                                            </Descriptions.Item>
                                        )}
                                        {developerProject.payment_plan
                                            .period_months != null && (
                                            <Descriptions.Item label="Period">
                                                {
                                                    developerProject
                                                        .payment_plan
                                                        .period_months
                                                }{" "}
                                                months
                                            </Descriptions.Item>
                                        )}
                                        {developerProject.payment_plan
                                            .interest_rate != null && (
                                            <Descriptions.Item label="Interest Rate">
                                                {
                                                    developerProject
                                                        .payment_plan
                                                        .interest_rate
                                                }
                                                %
                                            </Descriptions.Item>
                                        )}
                                    </Descriptions>
                                </div>
                            )}

                            {/* Distances */}
                            {developerProject.distances &&
                                Object.values(developerProject.distances).some(
                                    Boolean,
                                ) && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <Text
                                            strong
                                            className="text-xs text-gray-500 uppercase tracking-wide"
                                        >
                                            Distances
                                        </Text>
                                        <Row gutter={[8, 8]} className="mt-1">
                                            {developerProject.distances
                                                .sea_km != null && (
                                                <Col xs={12} sm={8}>
                                                    <StatBlock
                                                        label="Sea"
                                                        value={`${developerProject.distances.sea_km} km`}
                                                        icon={
                                                            <EnvironmentOutlined />
                                                        }
                                                    />
                                                </Col>
                                            )}
                                            {developerProject.distances
                                                .beach_km != null && (
                                                <Col xs={12} sm={8}>
                                                    <StatBlock
                                                        label="Beach"
                                                        value={`${developerProject.distances.beach_km} km`}
                                                        icon={
                                                            <EnvironmentOutlined />
                                                        }
                                                    />
                                                </Col>
                                            )}
                                            {developerProject.distances
                                                .hospital_km != null && (
                                                <Col xs={12} sm={8}>
                                                    <StatBlock
                                                        label="Hospital"
                                                        value={`${developerProject.distances.hospital_km} km`}
                                                        icon={
                                                            <EnvironmentOutlined />
                                                        }
                                                    />
                                                </Col>
                                            )}
                                            {developerProject.distances
                                                .market_km != null && (
                                                <Col xs={12} sm={8}>
                                                    <StatBlock
                                                        label="Market"
                                                        value={`${developerProject.distances.market_km} km`}
                                                        icon={
                                                            <EnvironmentOutlined />
                                                        }
                                                    />
                                                </Col>
                                            )}
                                            {developerProject.distances
                                                .school_km != null && (
                                                <Col xs={12} sm={8}>
                                                    <StatBlock
                                                        label="School"
                                                        value={`${developerProject.distances.school_km} km`}
                                                        icon={
                                                            <EnvironmentOutlined />
                                                        }
                                                    />
                                                </Col>
                                            )}
                                            {developerProject.distances
                                                .airport_km != null && (
                                                <Col xs={12} sm={8}>
                                                    <StatBlock
                                                        label="Airport"
                                                        value={`${developerProject.distances.airport_km} km`}
                                                        icon={
                                                            <EnvironmentOutlined />
                                                        }
                                                    />
                                                </Col>
                                            )}
                                        </Row>
                                    </div>
                                )}
                        </Card>
                    </div>
                </Col>

                {/* ─── Sidebar ─── */}
                <Col xs={24} lg={8}>
                    <div className="flex flex-col gap-4">
                        {/* Location */}
                        <Card
                            title={
                                <span>
                                    <EnvironmentOutlined className="mr-2" />
                                    Location
                                </span>
                            }
                            variant="outlined"
                            size="small"
                        >
                            {location ? (
                                <div>
                                    <div className="font-semibold text-gray-900">
                                        {location.name}
                                    </div>
                                    {location.address && (
                                        <div className="text-sm text-gray-500 mt-1">
                                            {[
                                                location.address.city,
                                                location.address.state,
                                                location.address.country,
                                            ]
                                                .filter(Boolean)
                                                .join(", ")}
                                        </div>
                                    )}
                                    {location.map_url && (
                                        <Button
                                            type="link"
                                            href={location.map_url}
                                            target="_blank"
                                            className="mt-2 p-0"
                                            icon={<EnvironmentOutlined />}
                                        >
                                            View on Map
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <Empty
                                    description="No location set"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            )}
                        </Card>

                        {/* Developer Info */}
                        {developerProject.developer && (
                            <Card
                                title={
                                    <span>
                                        <BankOutlined className="mr-2" />
                                        Developer
                                    </span>
                                }
                                variant="outlined"
                                size="small"
                            >
                                <div className="font-semibold text-gray-900">
                                    {developerProject.developer.name}
                                </div>
                                {developerProject.google_drive_link && (
                                    <Button
                                        type="link"
                                        href={
                                            developerProject.google_drive_link
                                        }
                                        target="_blank"
                                        className="mt-1 p-0"
                                    >
                                        Google Drive Folder
                                    </Button>
                                )}
                            </Card>
                        )}

                        {/* Quick Info */}
                        <Card
                            title={
                                <span>
                                    <InfoCircleOutlined className="mr-2" />
                                    Quick Info
                                </span>
                            }
                            variant="outlined"
                            size="small"
                        >
                            <Descriptions column={1} size="small">
                                <Descriptions.Item label="Reference Code">
                                    <Tag>{unitType.reference_code || "—"}</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="Created">
                                    {unitType.created_at
                                        ? new Date(
                                              unitType.created_at,
                                          ).toLocaleDateString()
                                        : "—"}
                                </Descriptions.Item>
                                {developerProject.rental_guarantee && (
                                    <Descriptions.Item label="Rental Guarantee">
                                        <Tag color="green">Yes</Tag>
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        </Card>
                    </div>
                </Col>
            </Row>
        </div>
    );
}
