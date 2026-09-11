import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import { Button, Segmented } from "antd";
import type { MenuProps } from "antd";
import {
    PlusOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    FilterOutlined,
    GlobalOutlined,
    FileTextOutlined,
    AppstoreOutlined,
    BarsOutlined,
    SafetyOutlined,
    SettingOutlined,
    HomeOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import PropertyCard from "./components/PropertyCard";
import { Property } from "@/Types";
import { PageProps } from "@inertiajs/core";
import { PROPERTY_TABLE_COLUMNS } from "@/Features/Properties/Columns";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import usePersistedPageSize from "@/Hooks/usePersistedPageSize";
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
import useTranslation from "@/Hooks/useTranslation";

import type {
    DeveloperProjectOption,
    DeveloperProject,
} from "@/Types/developerProject";
import ConstructionProjectsTable from "@/Features/DeveloperProjects/ConstructionProjectsTable";
import ConstructionProjectFormModal from "@/Features/DeveloperProjects/ConstructionProjectFormModal";
import { DataTable, withMobileResponsiveColumns } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import useMobileResponsiveLayoutFlag from "@/Hooks/useMobileResponsiveLayoutFlag";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useCurrencies } from "@/Hooks/useFormData";

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
    cities?: Array<{ name: string; label: string }>;
    currencies?: any[];
    default_currency_code?: string;
    default_currency_symbol?: string;
}

const Index = ({
    pageTitle,
    properties,
    default_currency_code: currencyCode,
    default_currency_symbol: currencySymbol,
    projects,
    developers,
    developerProjects,
    constructionProjects,
    cities,
}: IndexProps) => {
    const { t } = useTranslation();
    const isMobileResponsive = useMobileResponsiveLayoutFlag();
    const { td } = useTd();
    const { currencies } = useCurrencies();

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

    // ── View mode (list / grid) — persisted to localStorage ──
    const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
        try {
            const stored = localStorage.getItem("hibarr_properties_view");
            if (stored === "grid" || stored === "list") return stored;
        } catch {}
        return "grid";
    });
    const handleViewModeChange = useCallback((mode: "list" | "grid") => {
        setViewMode(mode);
        try {
            localStorage.setItem("hibarr_properties_view", mode);
        } catch {}
    }, []);
    const { props } = usePage<any>();
    const canManagePublishRequests =
        props.auth?.permissions?.manage_property_publish_requests === "all" ||
        props.auth?.permissions?.manage_property_publish_requests === 4;
    const canManagePropertyConfig =
        props.auth?.permissions?.manage_property_configuration === "all" ||
        props.auth?.permissions?.manage_property_configuration === 4;

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
                per_page: 16,
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
                cities,
                excludeFields: ["publishing_status", "search"],
            }),
        [projects, developers, developerProjects, cities],
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
            label: t("pages.properties.index.tabs.all"),
            icon: <AppstoreOutlined />,
        },
        {
            value: "properties",
            label: t("app.menu.properties"),
            icon: <HomeOutlined />,
        },
        {
            value: "my_drafts",
            label: t("pages.properties.index.tabs.my_drafts"),
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
    const columns = withMobileResponsiveColumns(
        PROPERTY_TABLE_COLUMNS(
            getActionItems,
            currencies,
            currencyCode,
            currencySymbol,
            t,
        ),
        ["property_type", "sale_type", "location", "publish_status", "created_at"],
        isMobileResponsive,
    );

    // Whether we're showing the properties table or construction projects
    const showPropertiesTable = activeTab !== "construction_projects";

    const handlePropertiesPageChange = useCallback(
        (page: number) => {
            router.get(
                route("properties.index"),
                { ...filters, ...sortParams, page },
                { preserveState: true, preserveScroll: true },
            );
        },
        [filters, sortParams],
    );

    const { persistPageSize } = usePersistedPageSize({
        storageKey: "hibarr_properties_per_page",
        currentPerPage: properties.per_page,
        onRestore: (perPage) =>
            router.get(
                route("properties.index"),
                { ...filters, ...sortParams, page: 1, per_page: perPage },
                { preserveState: true, preserveScroll: true },
            ),
    });

    const handlePropertiesPageSizeChange = useCallback(
        (per_page: number) => {
            persistPageSize(per_page);
            router.get(
                route("properties.index"),
                { ...filters, ...sortParams, page: 1, per_page },
                { preserveState: true, preserveScroll: true },
            );
        },
        [filters, sortParams, persistPageSize],
    );

    const propertiesPaginationMeta: LaravelPaginationMeta = {
        current_page: properties.current_page,
        last_page: properties.last_page,
        per_page: properties.per_page,
        total: properties.total,
        from: properties.from,
        to: properties.to,
    };

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh();

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: t("app.menu.properties") }]}
                searchComp={
                    showPropertiesTable ? (
                        <UniversalSearchBox
                            placeholder={t("app.properties.search_placeholder")}
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
                                    <Link href="/account/availability-requests">
                                        <Button
                                            type="text"
                                            icon={<SafetyOutlined />}
                                        >
                                            {t(
                                                "app.properties.actions.availability_requests",
                                            )}
                                        </Button>
                                    </Link>
                                    <Link href="/account/edit-access-requests">
                                        <Button
                                            type="text"
                                            icon={<EditOutlined />}
                                        >
                                            {t(
                                                "app.properties.actions.edit_access_requests",
                                            )}
                                        </Button>
                                    </Link>
                                    {canManagePublishRequests ? (
                                        <Link href="/account/publish-requests">
                                            <Button
                                                type="text"
                                                icon={<GlobalOutlined />}
                                            >
                                                {t(
                                                    "app.properties.actions.publish_requests",
                                                )}
                                            </Button>
                                        </Link>
                                    ) : null}
                                    {canManagePropertyConfig ? (
                                        <Link
                                            href={route("property-config.page")}
                                        >
                                            <Button
                                                type="text"
                                                icon={<SettingOutlined />}
                                            >
                                                {t(
                                                    "app.properties.actions.configuration",
                                                )}
                                            </Button>
                                        </Link>
                                    ) : null}

                                    <Link
                                        href={route(
                                            "expose-configuration.show",
                                        )}
                                    >
                                        <Button
                                            type="text"
                                            icon={<FileTextOutlined />}
                                        >
                                            Expose Configuration
                                        </Button>
                                    </Link>
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
                                        {td("Refresh", { source: "en" })}
                                    </Button>
                                    {/* Advanced Filters Button */}
                                    <Button
                                        icon={<FilterOutlined />}
                                        onClick={openDrawer}
                                    >
                                        {t("app.filter")}
                                    </Button>

                                    {/* View mode toggle */}
                                    <div className="flex bg-gray-100 rounded-md p-1">
                                        <Button
                                            type="text"
                                            icon={<BarsOutlined />}
                                            title="List view"
                                            className={
                                                viewMode === "list"
                                                    ? "!bg-white !shadow-sm"
                                                    : "hover:bg-white hover:shadow-sm"
                                            }
                                            onClick={() =>
                                                handleViewModeChange("list")
                                            }
                                        />
                                        <Button
                                            type="text"
                                            icon={<AppstoreOutlined />}
                                            title="Grid view"
                                            className={
                                                viewMode === "grid"
                                                    ? "!bg-white !shadow-sm"
                                                    : "hover:bg-white hover:shadow-sm"
                                            }
                                            onClick={() =>
                                                handleViewModeChange("grid")
                                            }
                                        />
                                    </div>

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

                            {/* Properties: List or Grid */}
                            {viewMode === "list" ? (
                                <DataTable<Property>
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
                                    paginationData={propertiesPaginationMeta}
                                    onPageChange={handlePropertiesPageChange}
                                    onPageSizeChange={
                                        handlePropertiesPageSizeChange
                                    }
                                    emptyState={{
                                        title: "No properties found",
                                        description:
                                            "Try adjusting your filters or add a new property.",
                                    }}
                                    scroll={{
                                        x: 1200,
                                        y: "calc(100vh - 320px)",
                                    }}
                                    size="small"
                                />
                            ) : (
                                <>
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                                        {(properties.data ?? []).map(
                                            (property) => (
                                                <PropertyCard
                                                    key={
                                                        property._source ===
                                                        "unit_type"
                                                            ? `ut_${property._unit_type_id}`
                                                            : property.id
                                                    }
                                                    property={property}
                                                    currencyCode={currencyCode}
                                                    currencySymbol={
                                                        currencySymbol
                                                    }
                                                    onEdit={(p) =>
                                                        handleAction("edit", p)
                                                    }
                                                    onDelete={(p) =>
                                                        handleAction(
                                                            "delete",
                                                            p,
                                                        )
                                                    }
                                                />
                                            ),
                                        )}
                                    </div>
                                    {/* Grid pagination */}
                                    {properties.total > properties.per_page && (
                                        <div className="flex justify-center pt-2">
                                            <Button
                                                disabled={
                                                    properties.current_page <= 1
                                                }
                                                onClick={() =>
                                                    router.get(
                                                        route(
                                                            "properties.index",
                                                        ),
                                                        {
                                                            ...filters,
                                                            ...sortParams,
                                                            page:
                                                                properties.current_page -
                                                                1,
                                                            per_page:
                                                                properties.per_page,
                                                        },
                                                        {
                                                            preserveState: true,
                                                            preserveScroll: false,
                                                        },
                                                    )
                                                }
                                            >
                                                Previous
                                            </Button>
                                            <span className="px-4 flex items-center text-sm text-gray-500">
                                                Page {properties.current_page}{" "}
                                                of {properties.last_page}{" "}
                                                &nbsp;·&nbsp; {properties.total}{" "}
                                                properties
                                            </span>
                                            <Button
                                                disabled={
                                                    properties.current_page >=
                                                    properties.last_page
                                                }
                                                onClick={() =>
                                                    router.get(
                                                        route(
                                                            "properties.index",
                                                        ),
                                                        {
                                                            ...filters,
                                                            ...sortParams,
                                                            page:
                                                                properties.current_page +
                                                                1,
                                                            per_page:
                                                                properties.per_page,
                                                        },
                                                        {
                                                            preserveState: true,
                                                            preserveScroll: false,
                                                        },
                                                    )
                                                }
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
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
