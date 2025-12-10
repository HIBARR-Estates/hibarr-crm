import { useState, useCallback, useEffect, useMemo } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import { Table, Button } from "antd";
import type { MenuProps } from "antd";
import {
    PlusOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    FilterOutlined,
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
    projects: Project[];
    developers: Developer[];
}

export default function Index({
    pageTitle,
    properties,
    default_currency_code: currencyCode,
    ...props
}: IndexProps) {
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
            createPropertyFilterConfig({ ...props, excludeFields: ["search"] }),
        [props]
        // TODO: Check if props can be more specific
    );

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

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
    const columns = PROPERTY_TABLE_COLUMNS(getActionItems, currencyCode);

    return (
        <DashboardLayout>
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
                                        ({ id }) => id
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
                                        }
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
        </DashboardLayout>
    );
}
