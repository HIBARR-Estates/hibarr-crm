import { useState, useCallback, useEffect, useMemo } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import { Table, Button, Segmented } from "antd";
import type { MenuProps } from "antd";
import {
    PlusOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    FilterOutlined,
    GlobalOutlined,
    FileTextOutlined,
    AppstoreOutlined,
    SafetyOutlined,
    SettingOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { PageProps } from "@inertiajs/core";
import { PROPERTY_TABLE_COLUMNS } from "@/Features/Properties/Columns";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import BulkActionSelector from "@/Features/Properties/BulkActions/BulkActionSelector";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import SavePropertyModal from "@/Features/Properties/SaveProperty/SavePropertyModal";
import ImportProperties from "@/Features/Properties/ImportProperties";
import ExportProperties from "@/Features/Properties/ExportProperties";
import DeleteProperty from "@/Features/Properties/DeleteProperty";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createPropertyFilterConfig } from "@/configs/propertyFilterConfig";
import { createPropertySearchConfig } from "@/configs/searchConfigs";
import usePageSort from "@/Hooks/usePageSort";

import type { DeveloperProjectOption } from "@/Types/developerProject";

// Legacy Project interface - kept for backwards compatibility
interface Project {
    id: number;
    project_name: string;
    project_admin: {
        id: number;
        name: string;
    } | null;
}

interface Developer {
    id: number;
    name: string;
    email: string;
}

interface PaginationData {
    data: Property[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export interface IndexProps extends PageProps {
    pageTitle: string;
    properties: PaginationData;
    /** @deprecated Use developerProjects instead */
    projects?: Project[];
    developers?: Developer[];
    /** New DeveloperProject list for bulk actions */
    developerProjects?: DeveloperProjectOption[];
    currencies?: any[];
    default_currency_code?: string;
    default_currency_symbol?: string;
}

const Index = ({
    pageTitle,
    properties,
    default_currency_code: currencyCode,
    default_currency_symbol: currencySymbol,
    currencies = [],
    projects,
    developers,
    developerProjects,
}: IndexProps) => {
    // Check if user is a sales manager (edit_product === 'all')
    const { props } = usePage<any>();
    const isSalesManager =
        props.auth?.permissions?.edit_product === "all" ||
        props.auth?.permissions?.edit_product === 4;

    // Debug: Log properties payload to see what price data looks like
    useEffect(() => {
        console.log("🔍 Properties payload:", properties);
        if (properties?.data && properties.data.length > 0) {
            const firstProperty = properties.data[0];
            let parsedPrice = null;
            try {
                if (typeof firstProperty.price === "string") {
                    parsedPrice = JSON.parse(firstProperty.price);
                } else {
                    parsedPrice = firstProperty.price;
                }
            } catch (e) {
                parsedPrice = firstProperty.price;
            }
            console.log("🔍 First property price:", {
                raw: firstProperty.price,
                type: typeof firstProperty.price,
                parsed: parsedPrice,
                fullProperty: firstProperty,
            });
        }
    }, [properties]);
    const {
        handleAction,
        handleClose,
        action,
        selected: property,
    } = useGenericEntityAction<Property>();
    // Check URL for create parameter to show drawer
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const showCreate = urlParams.get("create") === "true";
        if (showCreate) handleAction("add");
    }, []);

    // Handle browser back/forward button
    useEffect(() => {
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const showCreate = urlParams.get("create") === "true";
            if (showCreate) handleAction("add");
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Memoize configs to prevent unnecessary re-renders and filter resets
    const filterConfig = useMemo(
        () =>
            createPropertyFilterConfig({
                // projects,
                // developers,
                developerProjects,
                excludeFields: ["publishing_status", "search"],
            }),
        [projects, developers, developerProjects],
    );

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

    // Get current publishing status from URL params or default to 'all'
    const currentPublishingStatus = useMemo(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get("publishing_status") || "all";
    }, [filters]);

    // Handle publishing status change
    const handlePublishingStatusChange = (value: string) => {
        router.get(
            route("properties.index"),
            {
                ...filters,
                publishing_status: value === "all" ? undefined : value,
                page: 1, // Reset to first page on status change
            },
            {
                preserveState: true,
                preserveScroll: false,
            },
        );
    };

    // Publishing status options for the segmented control
    const publishingStatusOptions = [
        {
            value: "all",
            label: "All",
            icon: <AppstoreOutlined />,
        },
        {
            value: "published",
            label: "Published",
            icon: <GlobalOutlined />,
        },
        {
            value: "draft",
            label: "My Drafts",
            icon: <FileTextOutlined />,
        },
    ];

    // Sort handlers
    const { sortParams } = usePageSort({ routeName: "properties.index" });

    // Table row selection

    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Property>();

    // Action dropdown for each row
    const getActionItems = (record: Property): MenuProps["items"] => [
        {
            key: "view",
            label: (
                <Link href={route("properties.show", record.id)}>
                    <EyeOutlined className="mr-2" />
                    View
                </Link>
            ),
        },
        {
            key: "edit",
            label: (
                <span>
                    <EditOutlined className="mr-2" />
                    Edit
                </span>
            ),
            onClick: () => {
                handleAction("edit", record);
            },
        },
        {
            type: "divider",
        },
        {
            key: "delete",
            label: (
                <span className="text-red-600">
                    <DeleteOutlined className="mr-2" />
                    Delete
                </span>
            ),
            onClick: () => {
                handleAction("delete", record);
            },
        },
    ];

    // Table columns
    const columns = PROPERTY_TABLE_COLUMNS(
        getActionItems,
        currencies,
        currencyCode,
        currencySymbol,
    );

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Properties" }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder="Search properties by title, area, description..."
                        className="w-full"
                    />
                }
                filterSection={<ContextualActiveFilters />}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Publishing Status Toggle */}
                    <div className="flex justify-center">
                        <Segmented
                            options={publishingStatusOptions}
                            value={currentPublishingStatus}
                            onChange={(value) =>
                                handlePublishingStatusChange(value as string)
                            }
                            size="large"
                        />
                    </div>

                    {/* Header with Actions */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleAction("add")}
                            >
                                Add Property
                            </Button>
                            <Button
                                type="text"
                                icon={<ImportOutlined />}
                                onClick={() => {
                                    handleAction("import");
                                }}
                            >
                                Import
                            </Button>
                            <Link href="/account/availability-requests">
                                <Button type="text" icon={<SafetyOutlined />}>
                                    Availability Requests
                                </Button>
                            </Link>
                            {isSalesManager && (
                                <Link href={route("property-config.page")}>
                                    <Button
                                        type="text"
                                        icon={<SettingOutlined />}
                                    >
                                        Configuration
                                    </Button>
                                </Link>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Advanced Filters Button */}
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openDrawer}
                            >
                                Filters
                            </Button>

                            {/* Bulk Actions - Only show when items are selected */}
                            {selectedEntities.length > 0 && (
                                <BulkActionSelector
                                    selectedEntityIds={selectedEntities?.map(
                                        ({ id }) => id,
                                    )}
                                    clearSelected={clearSelected}
                                />
                            )}
                        </div>
                    </div>

                    {/* Properties Table */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <Table
                            columns={columns}
                            dataSource={properties.data}
                            rowKey="id"
                            rowSelection={rowSelection}
                            pagination={{
                                current: properties.current_page,
                                total: properties.total,
                                pageSize: properties.per_page,
                                showSizeChanger: false,
                                showQuickJumper: false,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} properties`,
                                onChange: (page, pageSize) => {
                                    router.get(
                                        route("properties.index"),
                                        {
                                            ...filters,
                                            ...sortParams,
                                            page,
                                            per_page: pageSize,
                                        },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        },
                                    );
                                },
                            }}
                            scroll={{ x: 1200 }}
                            size="small"
                        />
                    </div>

                    {/* Advanced Filters Drawer */}
                </div>
            </PageLayout>
            <SavePropertyModal
                open={["add", "edit"].includes(action || "")}
                onClose={handleClose}
                property={property}
            />
            <DeleteProperty
                open={action === "delete"}
                onClose={() => handleClose()}
                property={property}
            />
            <ImportProperties
                open={action === "import"}
                onClose={() => handleClose()}
            />
            <ExportProperties
                open={action === "export"}
                onClose={() => handleClose()}
            />

            {/* Filter Drawer */}
            <UniversalFilterDrawer config={filterConfig} />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
