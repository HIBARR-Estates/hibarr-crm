import { useState, useMemo, useCallback } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Button,
    Card,
    Descriptions,
    Tag,
    Table,
    Space,
    Empty,
    Popconfirm,
    Menu,
    Statistic,
    Row,
    Col,
    Image,
    Typography,
    List,
    Progress,
    Tabs,
} from "antd";
import type { TableColumnsType, MenuProps } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    EditOutlined,
    SettingOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
    HomeOutlined,
    PictureOutlined,
    DollarOutlined,
    FilePdfOutlined,
    AppstoreOutlined,
    BankOutlined,
    BuildOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
    ProjectLocation,
    DeveloperProjectExposeConfig,
    Developer,
} from "../../Types/developerProject";
import type { Property } from "../../Types";
import { useApiMutate } from "../../lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "../../lib/api/types";
import ExposeGenerationModal from "../../Features/DeveloperProjects/ExposeGenerationModal";
import UnitTypesSection from "../../Features/DeveloperProjects/UnitTypesSection";
import ConstructionProjectFormModal from "../../Features/DeveloperProjects/ConstructionProjectFormModal";

const { Title, Text, Paragraph } = Typography;

// ============================================
// Types
// ============================================

interface PropertyTypeSummary {
    type: string;
    count: number;
    bedrooms: { min: number | null; max: number | null };
    bathrooms: { min: number | null; max: number | null };
    area: { min: number | null; max: number | null };
    price: { min: number | null; max: number | null };
}

interface Statistics {
    total_properties: number;
    sold_properties: number;
    sold_percentage: number;
    available_properties: number;
    under_offer_properties: number;
}

interface ImageItem {
    id: number;
    url: string;
    name: string;
    source: "project" | "property";
    property_id?: number;
    property_title?: string;
}

interface PriceListItem {
    type: string;
    count: number;
    min_price: number | null;
    max_price: number | null;
    properties: Array<{
        id: number;
        title: string;
        price: number | null;
        status: string;
        bedrooms: string | null;
        bathrooms: number | null;
    }>;
}

export interface ShowProps extends PageProps {
    pageTitle: string;
    project: DeveloperProject & {
        developer?: Developer;
        location?: ProjectLocation;
        expose_config?: DeveloperProjectExposeConfig;
        properties?: Property[];
    };
    statistics: Statistics;
    propertyTypesSummary: PropertyTypeSummary[];
    facilities: string[];
    imagesByTag: Record<string, ImageItem[]>;
    priceList: PriceListItem[];
    unitTypes: DeveloperProjectUnitType[];
}

type SectionKey =
    | "overview"
    | "unit_types"
    | "facilities"
    | "exterior"
    | "interior"
    | "siteplan"
    | "pricelist"
    | "pdf";

// ============================================
// Section Components
// ============================================

const OverviewSection: React.FC<{
    project: ShowProps["project"];
    statistics: Statistics;
    propertyTypesSummary: PropertyTypeSummary[];
}> = ({ project, statistics, propertyTypesSummary }) => {
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
                if (record.price.min === record.price.max) {
                    return formatPrice(record.price.min);
                }
                return `From ${formatPrice(record.price.min)}`;
            },
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Stats Row */}
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Total Properties"
                            value={statistics.total_properties}
                            prefix={<HomeOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Available"
                            value={statistics.available_properties}
                            valueStyle={{ color: "#3f8600" }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Under Offer"
                            value={statistics.under_offer_properties}
                            valueStyle={{ color: "#cf9f00" }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Sold"
                            value={statistics.sold_properties}
                            suffix={
                                <Text type="secondary" className="text-sm">
                                    ({statistics.sold_percentage}%)
                                </Text>
                            }
                        />
                        <Progress
                            percent={statistics.sold_percentage}
                            showInfo={false}
                            strokeColor="#52c41a"
                            size="small"
                            className="mt-2"
                        />
                    </Card>
                </Col>
            </Row>

            {/* Project Info */}
            <Card title="Project Information">
                <Descriptions column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Project Name">
                        {project.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="Developer">
                        {project.developer ? (
                            <Link
                                href={route(
                                    "developers.show",
                                    project.developer.id,
                                )}
                            >
                                <Space>
                                    <BankOutlined />
                                    {project.developer.name}
                                </Space>
                            </Link>
                        ) : (
                            <Text type="secondary">No developer assigned</Text>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Description" span={2}>
                        {project.description || (
                            <Text type="secondary">No description</Text>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Location">
                        {project.location ? (
                            <Space>
                                <EnvironmentOutlined className="text-blue-500" />
                                {project.location.name}
                            </Space>
                        ) : (
                            <Text type="secondary">Not assigned</Text>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Expose Status">
                        {project.expose_config ? (
                            <Tag color="green">Configured</Tag>
                        ) : (
                            <Tag color="orange">Not configured</Tag>
                        )}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {/* Property Types Table */}
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

const FacilitiesSection: React.FC<{ facilities: string[] }> = ({
    facilities,
}) => {
    if (facilities.length === 0) {
        return (
            <Card>
                <Empty description="No facilities found" />
            </Card>
        );
    }

    return (
        <Card title="Facilities">
            <div className="flex flex-wrap gap-2">
                {facilities.map((facility, index) => (
                    <Tag key={index} color="blue" className="text-sm py-1 px-3">
                        {facility}
                    </Tag>
                ))}
            </div>
        </Card>
    );
};

const ImageGallerySection: React.FC<{
    title: string;
    images: ImageItem[];
}> = ({ title, images }) => {
    if (images.length === 0) {
        return (
            <Card title={title}>
                <Empty description={`No ${title.toLowerCase()} images found`} />
            </Card>
        );
    }

    return (
        <Card title={`${title} (${images.length})`}>
            <Image.PreviewGroup>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                        <div
                            key={`${image.source}-${image.id}`}
                            className="relative"
                        >
                            <Image
                                src={image.url}
                                alt={image.name}
                                className="rounded-lg object-cover"
                                style={{ width: "100%", height: 150 }}
                            />
                            {image.source === "property" && (
                                <Tag
                                    className="absolute bottom-2 left-2"
                                    color="blue"
                                >
                                    {image.property_title ||
                                        `Property #${image.property_id}`}
                                </Tag>
                            )}
                        </div>
                    ))}
                </div>
            </Image.PreviewGroup>
        </Card>
    );
};

const PriceListSection: React.FC<{ priceList: PriceListItem[] }> = ({
    priceList,
}) => {
    const formatPrice = (price: number | null) => {
        if (!price) return "-";
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
        }).format(price);
    };

    if (priceList.length === 0) {
        return (
            <Card title="Price List">
                <Empty description="No properties with pricing found" />
            </Card>
        );
    }

    return (
        <Card title="Price List by Property Type">
            <Tabs
                items={priceList.map((item) => ({
                    key: item.type,
                    label: (
                        <span>
                            {item.type} <Tag>{item.count}</Tag>
                        </span>
                    ),
                    children: (
                        <div>
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <Text strong>Price Range: </Text>
                                {item.min_price === item.max_price ? (
                                    formatPrice(item.min_price)
                                ) : (
                                    <>
                                        {formatPrice(item.min_price)} -{" "}
                                        {formatPrice(item.max_price)}
                                    </>
                                )}
                            </div>
                            <Table
                                dataSource={item.properties}
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 5 }}
                                columns={[
                                    {
                                        title: "Property",
                                        dataIndex: "title",
                                        key: "title",
                                        render: (title: string, record) => (
                                            <Link
                                                href={route(
                                                    "properties.show",
                                                    record.id,
                                                )}
                                            >
                                                {title ||
                                                    `Property #${record.id}`}
                                            </Link>
                                        ),
                                    },
                                    {
                                        title: "Beds",
                                        dataIndex: "bedrooms",
                                        key: "bedrooms",
                                        align: "center",
                                    },
                                    {
                                        title: "Baths",
                                        dataIndex: "bathrooms",
                                        key: "bathrooms",
                                        align: "center",
                                    },
                                    {
                                        title: "Price",
                                        dataIndex: "price",
                                        key: "price",
                                        render: (price: number | null) =>
                                            formatPrice(price),
                                    },
                                    {
                                        title: "Status",
                                        dataIndex: "status",
                                        key: "status",
                                        render: (status: string) => {
                                            const colors: Record<
                                                string,
                                                string
                                            > = {
                                                Available: "green",
                                                "Under offer": "orange",
                                                Sold: "red",
                                                Withdrawn: "default",
                                            };
                                            return (
                                                <Tag color={colors[status]}>
                                                    {status}
                                                </Tag>
                                            );
                                        },
                                    },
                                ]}
                            />
                        </div>
                    ),
                }))}
            />
        </Card>
    );
};

const PdfFilesSection: React.FC<{
    projectId: number;
    projectName: string;
    priceList: PriceListItem[];
}> = ({ projectId, projectName, priceList }) => {
    const [exposeModalOpen, setExposeModalOpen] = useState(false);
    const [selectedPriceListItem, setSelectedPriceListItem] =
        useState<PriceListItem | null>(null);

    const handleGenerateExpose = (item: PriceListItem) => {
        setSelectedPriceListItem(item);
        setExposeModalOpen(true);
    };

    const handleCloseModal = () => {
        setExposeModalOpen(false);
        setSelectedPriceListItem(null);
    };

    if (priceList.length === 0) {
        return (
            <Card title="PDF Files / Expose Generation">
                <Empty description="No property types available for expose generation" />
            </Card>
        );
    }

    return (
        <>
            <Card title="PDF Files / Expose Generation">
                <Paragraph className="mb-4">
                    Select a property type to generate an expose PDF. You will
                    be able to select specific properties and a lead/client
                    before generating.
                </Paragraph>
                <List
                    dataSource={priceList}
                    renderItem={(item) => (
                        <List.Item
                            actions={[
                                <Button
                                    key="generate"
                                    type="primary"
                                    icon={<FilePdfOutlined />}
                                    onClick={() => handleGenerateExpose(item)}
                                >
                                    Generate Expose
                                </Button>,
                            ]}
                        >
                            <List.Item.Meta
                                title={item.type}
                                description={`${item.count} properties available`}
                            />
                        </List.Item>
                    )}
                />
            </Card>

            {/* Expose Generation Modal */}
            {selectedPriceListItem && (
                <ExposeGenerationModal
                    open={exposeModalOpen}
                    onClose={handleCloseModal}
                    projectId={projectId}
                    projectName={projectName}
                    priceListItem={selectedPriceListItem}
                />
            )}
        </>
    );
};

// ============================================
// Main Component
// ============================================

const Show = ({
    pageTitle,
    project,
    statistics,
    propertyTypesSummary,
    facilities,
    imagesByTag,
    priceList,
    unitTypes,
}: ShowProps) => {
    const [activeSection, setActiveSection] = useState<SectionKey>("overview");
    const [editModalOpen, setEditModalOpen] = useState(false);

    const handleEditSuccess = useCallback(() => {
        router.reload();
    }, []);

    const menuItems: MenuProps["items"] = [
        {
            key: "overview",
            icon: <AppstoreOutlined />,
            label: "Overview",
        },
        {
            key: "unit_types",
            icon: <BuildOutlined />,
            label: `Unit Types (${unitTypes?.length || 0})`,
        },
        {
            key: "facilities",
            icon: <HomeOutlined />,
            label: "Facilities",
        },
        {
            key: "exterior",
            icon: <PictureOutlined />,
            label: `Exterior Images (${imagesByTag.exterior?.length || 0})`,
        },
        {
            key: "interior",
            icon: <PictureOutlined />,
            label: `Interior Images (${imagesByTag.interior?.length || 0})`,
        },
        {
            key: "siteplan",
            icon: <PictureOutlined />,
            label: `Site Plan (${(imagesByTag["floor-plan"]?.length || 0) + (imagesByTag["site-plan"]?.length || 0)})`,
        },
        {
            key: "pricelist",
            icon: <DollarOutlined />,
            label: "Price List",
        },
        {
            key: "pdf",
            icon: <FilePdfOutlined />,
            label: "PDF Files",
        },
    ];

    const renderSection = () => {
        switch (activeSection) {
            case "overview":
                return (
                    <OverviewSection
                        project={project}
                        statistics={statistics}
                        propertyTypesSummary={propertyTypesSummary}
                    />
                );
            case "unit_types":
                return (
                    <UnitTypesSection
                        projectId={project.id}
                        unitTypes={unitTypes ?? []}
                    />
                );
            case "facilities":
                return <FacilitiesSection facilities={facilities} />;
            case "exterior":
                return (
                    <ImageGallerySection
                        title="Exterior Images"
                        images={imagesByTag.exterior || []}
                    />
                );
            case "interior":
                return (
                    <ImageGallerySection
                        title="Interior Images"
                        images={imagesByTag.interior || []}
                    />
                );
            case "siteplan":
                return (
                    <ImageGallerySection
                        title="Site Plan / Floor Plan"
                        images={[
                            ...(imagesByTag["floor-plan"] || []),
                            ...(imagesByTag["site-plan"] || []),
                        ]}
                    />
                );
            case "pricelist":
                return <PriceListSection priceList={priceList} />;
            case "pdf":
                return (
                    <PdfFilesSection
                        projectId={project.id}
                        projectName={project.name}
                        priceList={priceList}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={
                [
                    project.developer
                        ? { name: "Developers", url: route("developers.index") }
                        : {
                              name: "Developer Projects",
                              url: route("developer-projects.index"),
                          },
                    project.developer
                        ? {
                              name: project.developer.name,
                              url: route(
                                  "developers.show",
                                  project.developer.id,
                              ),
                          }
                        : null,
                    { name: project.name },
                ].filter(Boolean) as { name: string; url?: string }[]
            }
        >
            <div className="flex gap-6">
                {/* Sidebar Navigation */}
                <div className="w-64 flex-shrink-0">
                    <Card className="sticky top-4">
                        <div className="mb-4">
                            <Link
                                href={
                                    project.developer
                                        ? route(
                                              "developers.show",
                                              project.developer.id,
                                          )
                                        : route("developer-projects.index")
                                }
                            >
                                <Button
                                    icon={<ArrowLeftOutlined />}
                                    type="link"
                                    className="pl-0"
                                >
                                    Back
                                </Button>
                            </Link>
                        </div>
                        <Menu
                            mode="vertical"
                            selectedKeys={[activeSection]}
                            onClick={({ key }) =>
                                setActiveSection(key as SectionKey)
                            }
                            items={menuItems}
                            className="border-0"
                        />
                        <div className="mt-4 pt-4 border-t space-y-2">
                            <Button
                                icon={<EditOutlined />}
                                block
                                onClick={() => setEditModalOpen(true)}
                            >
                                Edit Project
                            </Button>
                            <Link
                                href={route(
                                    "developer-projects.expose-config.show",
                                    project.id,
                                )}
                            >
                                <Button icon={<SettingOutlined />} block>
                                    Configure Expose
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">{renderSection()}</div>
            </div>

            {/* Edit Construction Project Modal */}
            <ConstructionProjectFormModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                project={project}
                onSuccess={handleEditSuccess}
            />
        </PageLayout>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
