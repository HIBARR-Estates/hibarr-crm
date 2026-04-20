import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
    BuildOutlined,
    HomeOutlined,
    ReloadOutlined,
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
import usePageRefresh from "@/Hooks/usePageRefresh";

import type {
    DeveloperProjectOption,
    DeveloperProject,
} from "@/Types/developerProject";
import ConstructionProjectsTable from "@/Features/DeveloperProjects/ConstructionProjectsTable";
import ConstructionProjectFormModal from "@/Features/DeveloperProjects/ConstructionProjectFormModal";

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

interface ConstructionProjectsPaginationData {
    data: DeveloperProject[];
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
    /** Lazy-loaded construction projects for the Construction Projects tab */
    constructionProjects?: ConstructionProjectsPaginationData;
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
    constructionProjects,
}: IndexProps) => {
    // ── Active tab state ──
    type ActiveTab =
        | "all"
        | "properties"
        | "my_drafts"
        | "construction_projects";

    // Derive tab from URL params — kept in sync after every Inertia navigation
    const deriveTabFromUrl = (): ActiveTab => {
        const urlParams = new URLSearchParams(window.location.search);
        const pubStatus = urlParams.get("publishing_status");
        if (pubStatus === "draft") return "my_drafts";
        if (pubStatus === "published") return "properties";
        return "all";
    };

    const [activeTab, setActiveTab] = useState<ActiveTab>(deriveTabFromUrl);
    // Track whether the user is on the construction projects tab (client-only, not URL-driven)
    const cpTabRef = useRef(false);

    // Re-sync activeTab from URL after every Inertia navigation.
    // This covers both preserveState=true and full remount scenarios.
    // We skip sync when on the construction_projects tab since that is
    // purely client-side and does not change URL params.
    useEffect(() => {
        const removeListener = router.on("navigate", () => {
            if (!cpTabRef.current) {
                setActiveTab(deriveTabFromUrl());
            }
        });
        return removeListener;
    }, []);

    const [cpDataLoaded, setCpDataLoaded] = useState(false);
    const [cpLoading, setCpLoading] = useState(false);
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
        setSelected: setProperty,
    } = useGenericEntityAction<Property>();

    // ── Construction project modal state ──
    const {
        handleAction: handleCpAction,
        handleClose: handleCpClose,
        action: cpAction,
        selected: selectedConstructionProject,
    } = useGenericEntityAction<DeveloperProject>();

    // ── Handle unified tab switch ──
    const handleTabChange = useCallback(
        (value: string) => {
            const tab = value as ActiveTab;

            if (tab === "construction_projects") {
                cpTabRef.current = true;
                setActiveTab("construction_projects");
                if (!cpDataLoaded) {
                    setCpLoading(true);
                    router.reload({
                        only: ["constructionProjects"],
                        onSuccess: () => {
                            setCpDataLoaded(true);
                            setCpLoading(false);
                        },
                        onError: () => {
                            setCpLoading(false);
                        },
                    });
                }
                return;
            }

            // Leaving CP tab — allow URL-based sync again
            cpTabRef.current = false;
            setActiveTab(tab); // Optimistic update — navigate listener will confirm
            // Map tab to backend filter params
            const params: Record<string, any> = {
                page: 1,
                per_page: 15,
                sort_by: "",
                sort_direction: "asc",
            };
            if (tab === "properties") {
                params.publishing_status = "published";
            } else if (tab === "my_drafts") {
                params.publishing_status = "draft";
                params.source = "properties"; // drafts are real properties only
            }
            // "all" → no filter params

            router.get(route("properties.index"), params, {
                preserveState: true,
                preserveScroll: false,
            });
        },
        [cpDataLoaded],
    );

    // Mark data as loaded if constructionProjects arrives via props
    useEffect(() => {
        if (constructionProjects && !cpDataLoaded) {
            setCpDataLoaded(true);
            setCpLoading(false);
        }
    }, [constructionProjects]);

    const handleCpSuccess = useCallback(() => {
        router.reload({ only: ["constructionProjects"] });
    }, []);
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

    // Unified tab options
    const tabOptions = [
        {
            value: "all",
            label: "All",
            icon: <AppstoreOutlined />,
        },
        {
            value: "properties",
            label: "Properties",
            icon: <HomeOutlined />,
        },
        {
            value: "my_drafts",
            label: "My Drafts",
            icon: <FileTextOutlined />,
        },
        // {
        //     value: "construction_projects",
        //     label: "Projects",
        //     icon: <BuildOutlined />,
        // },
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

    // Whether we're showing the properties table or construction projects
    const showPropertiesTable = activeTab !== "construction_projects";

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh();

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Properties" }]}
                searchComp={
                    showPropertiesTable ? (
                        <UniversalSearchBox
                            placeholder="Search properties by title, area, description..."
                            className="w-full"
                        />
                    ) : undefined
                }
                filterSection={
                    showPropertiesTable ? (
                        <ContextualActiveFilters />
                    ) : undefined
                }
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Unified Tab Navigation */}
                    <div className="flex justify-center">
                        <Segmented
                            options={tabOptions}
                            value={activeTab}
                            onChange={handleTabChange}
                            size="large"
                        />
                    </div>

                    {/* ═══ Properties / Unit Types Table ═══ */}
                    {showPropertiesTable && (
                        <>
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
                                        <Button
                                            type="text"
                                            icon={<SafetyOutlined />}
                                        >
                                            Availability Requests
                                        </Button>
                                    </Link>
                                    {isSalesManager ? (
                                        <Link href="/account/publish-requests">
                                            <Button
                                                type="text"
                                                icon={<GlobalOutlined />}
                                            >
                                                Publish Requests
                                            </Button>
                                        </Link>
                                    ) : null}
                                    {isSalesManager ? (
                                        <Link
                                            href={route("property-config.page")}
                                        >
                                            <Button
                                                type="text"
                                                icon={<SettingOutlined />}
                                            >
                                                Configuration
                                            </Button>
                                        </Link>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button
                                        icon={
                                            <ReloadOutlined
                                                spin={isRefreshing}
                                            />
                                        }
                                        onClick={refresh}
                                        disabled={isRefreshing}
                                        type="text"
                                    >
                                        Refresh
                                    </Button>
                                    {/* Advanced Filters Button */}
                                    <Button
                                        icon={<FilterOutlined />}
                                        onClick={openDrawer}
                                    >
                                        Filters
                                    </Button>

                                    {/* Bulk Actions - Only show when items are selected */}
                                    {selectedEntities.filter(
                                        (e) => e._source !== "unit_type",
                                    ).length > 0 && (
                                        <BulkActionSelector
                                            selectedEntityIds={selectedEntities
                                                .filter(
                                                    (e) =>
                                                        e._source !==
                                                        "unit_type",
                                                )
                                                .map(({ id }) => +id)}
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
                                    rowKey={(record) =>
                                        record._source === "unit_type"
                                            ? `ut_${record._unit_type_id}`
                                            : record.id
                                    }
                                    rowSelection={{
                                        ...rowSelection,
                                        getCheckboxProps: (
                                            record: Property,
                                        ) => ({
                                            disabled:
                                                record._source === "unit_type",
                                            title:
                                                record._source === "unit_type"
                                                    ? "Unit types cannot be selected for bulk actions"
                                                    : undefined,
                                        }),
                                    }}
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
                        </>
                    )}

                    {/* ═══ Construction Projects View ═══ */}
                    {activeTab === "construction_projects" && (
                        <ConstructionProjectsTable
                            projects={constructionProjects ?? null}
                            onEdit={(project) =>
                                handleCpAction("edit", project)
                            }
                            onAdd={() => handleCpAction("add")}
                            loading={cpLoading}
                        />
                    )}

                    {/* Advanced Filters Drawer */}
                </div>
            </PageLayout>

            {/* Property Modals */}
            <SavePropertyModal
                open={["add", "edit"].includes(action || "")}
                onClose={handleClose}
                property={property}
                setProperty={setProperty}
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

            {/* Construction Project Modal */}
            <ConstructionProjectFormModal
                open={["add", "edit"].includes(cpAction || "")}
                onClose={handleCpClose}
                project={
                    cpAction === "edit"
                        ? selectedConstructionProject
                        : undefined
                }
                onSuccess={handleCpSuccess}
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
