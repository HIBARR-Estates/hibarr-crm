import { useState, useCallback, useEffect } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import { Table, Button, Form } from "antd";
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
import BasicPropertyFilterBox from "@/Features/Properties/Filter/BasicPropertyFilterBox";
import AdvancedPropertyFilterForm from "@/Features/Properties/Filter/AdvancedPropertyFilterForm";
import { filterProperties } from "@/lib/utils";
import usePageFilter from "@/Hooks/usePageFilter";
import FilterDrawer from "@/Components/FilterDrawer";
import ActiveFilters from "@/Components/ActiveFilters";
import useTranslation from "@/Hooks/useTranslation";

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
    default_currency_symbol: currencySymbol,
    currencies = [],
}: IndexProps) {
    const { t } = useTranslation();

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
    // filters and filter handlers
    const {
        filters,
        drawerOpen,
        openFilterDrawer,
        closeFilterDrawer,
        handleQuickFilter,
        removeFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
        clearAllFilters,
    } = usePageFilter({ handleClose, routeName: "properties.index" });

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
                    {t("app.view")}
                </Link>
            ),
        },
        {
            key: "edit",
            label: (
                <span>
                    <EditOutlined className="mr-2" />
                    {t("app.edit")}
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
                    {t("app.delete")}
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
        t,
    );

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: t("app.menu.properties") }]}
                searchComp={
                    <BasicPropertyFilterBox
                        filters={filters}
                        handleResetFilters={handleResetFilters}
                        handleQuickFilter={handleQuickFilter}
                        handleResetQuickFilters={handleResetQuickFilters}
                        handleSubmit={handleFilterSubmit}
                    />
                }
                filterSection={
                    <>
                        {/* Active Filters */}
                        <ActiveFilters
                            filters={filters}
                            onRemoveFilter={removeFilter}
                            onClearAll={clearAllFilters}
                        />
                    </>
                }
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
                                {t("app.properties.actions.add")}
                            </Button>
                            <Button
                                type="text"
                                icon={<ImportOutlined />}
                                onClick={() => {
                                    handleAction("import");
                                }}
                            >
                                {t("app.import")}
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Advanced Filters Button */}
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openFilterDrawer}
                            >
                                {t(
                                    "pages.properties.index_old.advanced_filters",
                                )}
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
                    <div className="bg-white rounded-lg border border-gray-200 px-3">
                        <Table
                            columns={columns}
                            dataSource={filterProperties(
                                properties.data,
                                filters,
                            )}
                            rowKey="id"
                            rowSelection={rowSelection}
                            pagination={{
                                current: properties.current_page,
                                total: properties.total,
                                pageSize: properties.per_page,
                                showSizeChanger: false,
                                showQuickJumper: false,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} ${t("pages.properties.index.pagination.of")} ${total} ${t("pages.properties.index.pagination.properties")}`,
                                onChange: (page, pageSize) => {
                                    router.get(
                                        route("properties.index"),
                                        {
                                            ...filters,
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
            <FilterDrawer
                open={drawerOpen}
                onClose={closeFilterDrawer}
                title={t(
                    "pages.properties.index_old.advanced_property_filters",
                )}
                filters={filters}
                onApplyFilters={handleFilterSubmit}
                onResetFilters={handleResetFilters}
            >
                <AdvancedPropertyFilterForm
                    filters={filters}
                    onFilterChange={handleQuickFilter}
                />
            </FilterDrawer>
        </DashboardLayout>
    );
}
