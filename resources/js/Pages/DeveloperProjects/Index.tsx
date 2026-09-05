import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import {
    Button,
    Input,
    Pagination as AntPagination,
    Select,
    Tooltip,
} from "antd";
import {
    Plus,
    MapPin,
    Search,
    Building2,
    Users,
    X,
    FileText,
    CornerDownLeft,
} from "lucide-react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import type { PageProps } from "../../Components/DashboardLayout";
import type {
    DeveloperProject,
    ProjectLocationOption,
} from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "@/lib/api/types";
import ProjectCard from "./components/ProjectCard";
import ProjectFormModal from "./components/ProjectFormModal";
import SortDropdown from "./components/SortDropdown";
import ProjectsFiltersModal, {
    type ProjectsFilterDraft,
} from "./components/ProjectsFiltersModal";
import {
    buildProjectsTitle,
    countActiveProjectFilters,
} from "./utils/buildProjectsTitle";
import { usePermission } from "@/lib/permissionUtils";
import { PROJECT_CONSTRUCTION_STATUSES } from "@/Features/Properties/SaveProperty/constructionProjectConfig";
import { formatLocationNameForDisplay } from "@/lib/utils";
import "@/Components/Redesign/redesign.css";
import EntityListHeader from "@/Components/Redesign/primitives/EntityListHeader";
import RedesignButton from "@/Components/Redesign/primitives/Button";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import { describeFilters } from "@/Features/Filters/filterSummary";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import createProjectFilterConfig from "@/configs/projectFilterConfig";
import { mergeQueryParams } from "@/lib/inertiaQuery";

// ============================================
// Types
// ============================================

interface LookupOption {
    name: string;
    label: string;
}

interface FilterLocation {
    id: number;
    name: string;
    city?: string | null;
    area?: string | null;
}

interface PaginationData {
    data: DeveloperProject[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export interface IndexProps extends Omit<PageProps, "filters"> {
    pageTitle: string;
    projects: PaginationData | null | undefined;
    developers: Array<{ id: number; name: string }>;
    locations: FilterLocation[];
    constructionStatuses: LookupOption[];
    primaryCategories: LookupOption[];
    titleDeedTypes?: LookupOption[];
    unitTypeOptions?: LookupOption[];
    projectFacilities?: Array<{ name: string; label: string; icon?: string | null }>;
    visibility?: {
        enabled?: boolean;
        canSeeHidden?: boolean;
        canToggleHidden?: boolean;
    };
    filters?:
        | {
              search?: string;
              sort?: string;
              location_id?: string;
              city?: string;
              area?: string;
              developer_id?: string;
              construction_status?: string;
              primary_category?: string;
              payment_plan_duration?: string;
              price_min?: string;
              price_max?: string;
          }
        | null
        | undefined;
}

interface LocationsResponse {
    status: string;
    locations: ProjectLocationOption[];
}

const VISIT_OPTIONS: {
    preserveState: boolean;
    preserveScroll: boolean;
    replace: boolean;
    only: string[];
} = {
    preserveState: true,
    preserveScroll: true,
    replace: true,
    only: ["projects", "filters"],
};

// ============================================
// Empty State
// ============================================

function EmptyState({ onAdd }: { onAdd?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2
                size={52}
                className="text-gray-200 mb-4"
                strokeWidth={1.5}
            />
            <p className="text-base font-semibold text-gray-500 mb-1">
                No projects found
            </p>
            <p className="text-sm text-gray-400 mb-5">
                Create your first construction project to get started.
            </p>
            {onAdd && (
                <Button
                    type="primary"
                    icon={<Plus size={14} />}
                    onClick={onAdd}
                >
                    New Project
                </Button>
            )}
        </div>
    );
}

// ============================================
// Main Page
// ============================================

const Index = ({
    pageTitle,
    projects: rawProjects,
    filters: rawFilters,
    developers,
    locations: filterLocations,
    constructionStatuses,
    primaryCategories,
    titleDeedTypes,
    unitTypeOptions,
    projectFacilities,
    visibility,
}: IndexProps) => {
    const safeFilters =
        rawFilters && !Array.isArray(rawFilters) ? rawFilters : {};
    const projects: PaginationData = rawProjects ?? {
        data: [],
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 0,
        from: 0,
        to: 0,
    };

    const { t } = useTranslation();
    const { props: pageProps } = usePage<PageProps>();
    const filtersV2Enabled =
        pageProps.featureFlags?.["crm.projects-filters-v2"] === true;
    const filtersModalEnabled =
        pageProps.featureFlags?.["crm.projects-filters-modal"] === true ||
        filtersV2Enabled;

    const showHiddenBadge =
        visibility?.enabled === true && visibility?.canSeeHidden === true;
    const canToggleHidden =
        visibility?.enabled === true && visibility?.canToggleHidden === true;

    const { hasPermission } = usePermission();
    const canAdd = hasPermission("add_developer_projects");
    const canEdit = hasPermission("edit_developer_projects");
    const canDelete = hasPermission("delete_developer_projects");

    const [projectFormOpen, setProjectFormOpen] = useState(false);
    const [filtersModalOpen, setFiltersModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] =
        useState<DeveloperProject | null>(null);
    const [projectToDelete, setProjectToDelete] =
        useState<DeveloperProject | null>(null);

    const [search, setSearch] = useState(safeFilters.search ?? "");
    const [sortValue, setSortValue] = useState(safeFilters.sort ?? "newest");
    const [locationId, setLocationId] = useState(safeFilters.location_id ?? "");
    const [city, setCity] = useState(safeFilters.city ?? "");
    const [area, setArea] = useState(safeFilters.area ?? "");
    const [developerId, setDeveloperId] = useState(
        safeFilters.developer_id ?? "",
    );
    const [constructionStatus, setConstructionStatus] = useState(
        safeFilters.construction_status ?? "",
    );
    const [primaryCategory, setPrimaryCategory] = useState(
        safeFilters.primary_category ?? "",
    );
    const [paymentPlanDuration, setPaymentPlanDuration] = useState(
        safeFilters.payment_plan_duration ?? "",
    );
    const [priceMin, setPriceMin] = useState(safeFilters.price_min ?? "");
    const [priceMax, setPriceMax] = useState(safeFilters.price_max ?? "");

    // v2 filter workbench (crm.projects-filters-v2) — multi-select fields,
    // saved views, and the expanded field set. FilterProvider is mounted
    // app-wide, so usePageSearchAndFilter is safe to call even when v2 is
    // off; only the JSX below actually renders anything with it.
    //
    // Deliberately NOT deriving this config from live draftFilters (e.g. for
    // a city->area cascade): usePageSearchAndFilter re-hydrates draftFilters
    // from the URL every time the config identity changes, so depending on
    // draftFilters here would reset whatever the user just clicked.
    const filterConfig = useMemo(
        () =>
            createProjectFilterConfig({
                developers,
                locations: filterLocations,
                constructionStatuses,
                primaryCategories,
                titleDeedTypes,
                unitTypeOptions,
                projectFacilities,
                visibilityEnabled: visibility?.enabled === true,
                canSeeHidden: visibility?.canSeeHidden === true,
                excludeFields: ["search"],
            }),
        [
            developers,
            filterLocations,
            constructionStatuses,
            primaryCategories,
            titleDeedTypes,
            unitTypeOptions,
            projectFacilities,
            visibility,
        ],
    );
    const { filter } = usePageSearchAndFilter({ filterConfig });
    const v2ActiveFilterCount = useMemo(
        () => describeFilters(filter.config, filter.filters).length,
        [filter.config, filter.filters],
    );

    const durationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const priceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<any>(null);
    const keepSearchFocused = useRef(false);

    const locationsQuery = useApiQuery<LocationsResponse>({
        path: route("project-locations.all"),
        options: { enabled: projectFormOpen },
    });
    const locations = locationsQuery.data?.locations ?? [];

    const deleteMutation = useApiMutate<
        Record<string, never>,
        null,
        ApiSuccessResponse<null>
    >(
        projectToDelete
            ? route("developer-projects.destroy", projectToDelete.id)
            : "",
        "DELETE",
        () => {
            setProjectToDelete(null);
            router.reload({ only: ["projects"] });
        },
    );

    useEffect(() => {
        if (projectToDelete && !deleteMutation.isPending) {
            deleteMutation.mutate({});
        }
    }, [projectToDelete]);

    const visitIndex = (
        params: Record<string, any>,
        options: Partial<typeof VISIT_OPTIONS> = {},
    ) => {
        router.get(route("developer-projects.index"), params, {
            ...VISIT_OPTIONS,
            ...options,
            onFinish: () => {
                if (keepSearchFocused.current) {
                    searchInputRef.current?.focus?.({
                        preventScroll: true,
                    });
                }
            },
        });
    };

    const buildParams = (overrides: Record<string, string> = {}) => {
        const base: Record<string, string> = {};
        if (search) base.search = search;
        if (sortValue && sortValue !== "newest") base.sort = sortValue;
        if (developerId) base.developer_id = developerId;
        if (constructionStatus) base.construction_status = constructionStatus;
        if (primaryCategory) base.primary_category = primaryCategory;
        if (paymentPlanDuration)
            base.payment_plan_duration = paymentPlanDuration;
        if (priceMin) base.price_min = priceMin;
        if (priceMax) base.price_max = priceMax;

        if (filtersModalEnabled) {
            if (city) base.city = city;
            if (city && area) base.area = area;
        } else if (locationId) {
            base.location_id = locationId;
        }

        const merged = { ...base, ...overrides };
        Object.keys(merged).forEach((k) => {
            if (!merged[k]) delete merged[k];
        });
        return merged;
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        keepSearchFocused.current = true;
    };

    // Fires on Enter, clicking the search icon, or clicking the clear ("x")
    // button — Input.Search calls onSearch with the current (post-clear)
    // value in all three cases, so clearing the box clears the search too.
    const submitSearch = (value: string) => {
        setSearch(value);
        // Under v2, filters live in the URL (not the legacy per-field state
        // buildParams reads), so merge into the current query string instead
        // of reconstructing it from stale local state.
        visitIndex(
            filtersV2Enabled
                ? mergeQueryParams({ search: value })
                : buildParams({ search: value }),
        );
    };

    const handleSortChange = (value: string) => {
        keepSearchFocused.current = false;
        setSortValue(value);
        visitIndex(
            filtersV2Enabled
                ? mergeQueryParams({ sort: value === "newest" ? "" : value })
                : buildParams({ sort: value }),
        );
    };

    const handlePriceChange = (
        key: "price_min" | "price_max",
        value: string,
    ) => {
        keepSearchFocused.current = false;
        if (key === "price_min") setPriceMin(value);
        else setPriceMax(value);
        if (priceDebounce.current) clearTimeout(priceDebounce.current);
        priceDebounce.current = setTimeout(() => {
            visitIndex(buildParams({ [key]: value }));
        }, 380);
    };

    const handlePaymentPlanDurationChange = (value: string) => {
        keepSearchFocused.current = false;
        const normalizedValue = value.replace(/\D/g, "");
        setPaymentPlanDuration(normalizedValue);
        if (durationDebounce.current) clearTimeout(durationDebounce.current);
        durationDebounce.current = setTimeout(() => {
            visitIndex(
                buildParams({ payment_plan_duration: normalizedValue }),
            );
        }, 380);
    };

    const handleFilterChange = (key: string, value: string) => {
        keepSearchFocused.current = false;
        switch (key) {
            case "location_id":
                setLocationId(value);
                break;
            case "developer_id":
                setDeveloperId(value);
                break;
            case "construction_status":
                setConstructionStatus(value);
                break;
            case "primary_category":
                setPrimaryCategory(value);
                break;
        }
        visitIndex(buildParams({ [key]: value }));
    };

    const applyModalFilters = (draft: ProjectsFilterDraft) => {
        keepSearchFocused.current = false;
        setDeveloperId(draft.developer_id);
        setCity(draft.city);
        setArea(draft.area);
        setConstructionStatus(draft.construction_status);
        setPrimaryCategory(draft.primary_category);
        setPaymentPlanDuration(draft.payment_plan_duration);
        setPriceMin(draft.price_min);
        setPriceMax(draft.price_max);
        setFiltersModalOpen(false);

        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (sortValue && sortValue !== "newest") params.sort = sortValue;
        if (draft.developer_id) params.developer_id = draft.developer_id;
        if (draft.city) params.city = draft.city;
        if (draft.city && draft.area) params.area = draft.area;
        if (draft.construction_status)
            params.construction_status = draft.construction_status;
        if (draft.primary_category)
            params.primary_category = draft.primary_category;
        if (draft.payment_plan_duration)
            params.payment_plan_duration = draft.payment_plan_duration;
        if (draft.price_min) params.price_min = draft.price_min;
        if (draft.price_max) params.price_max = draft.price_max;

        visitIndex(params);
    };

    const resetModalFilters = () => {
        keepSearchFocused.current = false;
        setDeveloperId("");
        setCity("");
        setArea("");
        setConstructionStatus("");
        setPrimaryCategory("");
        setPaymentPlanDuration("");
        setPriceMin("");
        setPriceMax("");

        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (sortValue && sortValue !== "newest") params.sort = sortValue;
        visitIndex(params);
    };

    const hasActiveFilters = filtersModalEnabled
        ? !!(
              city ||
              area ||
              developerId ||
              constructionStatus ||
              primaryCategory ||
              paymentPlanDuration ||
              priceMin ||
              priceMax
          )
        : !!(
              locationId ||
              developerId ||
              constructionStatus ||
              primaryCategory ||
              paymentPlanDuration ||
              priceMin ||
              priceMax
          );

    const activeFilterCount = countActiveProjectFilters(
        filtersModalEnabled
            ? {
                  developerId,
                  city,
                  area,
                  constructionStatus,
                  primaryCategory,
                  paymentPlanDuration,
                  priceMin,
                  priceMax,
              }
            : {
                  developerId,
                  locationId,
                  constructionStatus,
                  primaryCategory,
                  paymentPlanDuration,
                  priceMin,
                  priceMax,
              },
    );

    const handleClearFilters = () => {
        keepSearchFocused.current = false;
        setLocationId("");
        setCity("");
        setArea("");
        setDeveloperId("");
        setConstructionStatus("");
        setPrimaryCategory("");
        setPaymentPlanDuration("");
        setPriceMin("");
        setPriceMax("");
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (sortValue && sortValue !== "newest") params.sort = sortValue;
        visitIndex(params);
    };

    const filterDraft: ProjectsFilterDraft = useMemo(
        () => ({
            developer_id: developerId,
            city,
            area,
            construction_status: constructionStatus,
            primary_category: primaryCategory,
            payment_plan_duration: paymentPlanDuration,
            price_min: priceMin,
            price_max: priceMax,
        }),
        [
            developerId,
            city,
            area,
            constructionStatus,
            primaryCategory,
            paymentPlanDuration,
            priceMin,
            priceMax,
        ],
    );

    const titleResult = useMemo(() => {
        // v2 has its own quiet filter sentence (ActiveFilterSentence) below
        // the toolbar; the legacy dynamic-sentence subtitle here is built
        // from single-value state that v2 never populates, so skip it.
        if (!filtersModalEnabled || filtersV2Enabled || !hasActiveFilters) {
            return {
                sentence: "Projects",
                filterSummary: "",
                useSubtitle: false,
            };
        }

        const developerName =
            developers.find((d) => String(d.id) === developerId)?.name ?? null;
        const statusLabel =
            PROJECT_CONSTRUCTION_STATUSES.find(
                (s) => s.value === constructionStatus,
            )?.label ?? null;
        const categoryLabel =
            primaryCategories.find((c) => c.name === primaryCategory)?.label ??
            null;

        return buildProjectsTitle({
            developerName,
            city: city || null,
            area: area || null,
            statusLabel,
            categoryLabel,
            priceMin: priceMin || null,
            priceMax: priceMax || null,
            currencySymbol: (pageProps as any).default_currency_symbol ?? "",
            planMonths: paymentPlanDuration || null,
        });
    }, [
        filtersModalEnabled,
        filtersV2Enabled,
        hasActiveFilters,
        developers,
        developerId,
        city,
        area,
        constructionStatus,
        primaryCategory,
        primaryCategories,
        priceMin,
        priceMax,
        paymentPlanDuration,
        pageProps,
    ]);

    const handleAdd = () => {
        setSelectedProject(null);
        setProjectFormOpen(true);
    };

    const handleEdit = useCallback((project: DeveloperProject) => {
        setSelectedProject(project);
        setProjectFormOpen(true);
    }, []);

    const handleDelete = useCallback((project: DeveloperProject) => {
        setProjectToDelete(project);
    }, []);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["projects"] });
    }, []);

    const goToPage = (page: number) => {
        keepSearchFocused.current = false;
        visitIndex(
            filtersV2Enabled
                ? mergeQueryParams({ page: String(page) })
                : { ...buildParams(), page: String(page) },
            { replace: false },
        );
    };

    // Legacy modal keeps its dynamic filter-summary sentence; everything
    // else (v2, and the no-filters-applied case) just shows the count.
    const headerSubtitle = titleResult.useSubtitle
        ? titleResult.filterSummary.charAt(0).toUpperCase() +
          titleResult.filterSummary.slice(1)
        : `${projects.total.toLocaleString()} projects`;

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: t("app.menu.projects") }]}
                searchComp={
                    <Input.Search
                        ref={searchInputRef}
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onSearch={submitSearch}
                        onFocus={() => {
                            keepSearchFocused.current = true;
                        }}
                        onBlur={() => {
                            // Delay so onFinish can still refocus after visit
                            setTimeout(() => {
                                if (
                                    document.activeElement !==
                                    searchInputRef.current?.input
                                ) {
                                    keepSearchFocused.current = false;
                                }
                            }, 0);
                        }}
                        placeholder="Search projects by name, description…"
                        prefix={
                            <Search size={14} className="text-gray-400" />
                        }
                        suffix={
                            <Tooltip title="Press Enter to search">
                                <CornerDownLeft
                                    size={13}
                                    className="text-gray-400"
                                />
                            </Tooltip>
                        }
                        className="w-full"
                        allowClear
                    />
                }
                mainContentClassName="p-0"
            >
                <EntityListHeader
                    title={t("app.menu.projects")}
                    subtitle={headerSubtitle}
                    actions={
                        <>
                            {canAdd && (
                                <RedesignButton
                                    variant="primary"
                                    icon={<Plus size={14} />}
                                    onClick={handleAdd}
                                >
                                    New Project
                                </RedesignButton>
                            )}

                            <Link
                                href={route("project-locations.index")}
                                className="dr-btn dr-btn-ghost"
                            >
                                <MapPin size={14} />
                                Manage Locations
                            </Link>

                            <Link
                                href={route("developers.index")}
                                className="dr-btn dr-btn-ghost"
                            >
                                <Users size={14} />
                                Developers
                            </Link>

                            <Link
                                href={route("expose-configuration.show")}
                                className="dr-btn dr-btn-ghost"
                            >
                                <FileText size={14} />
                                Expose Configuration
                            </Link>
                        </>
                    }
                    toolbarLeft={
                        <>
                            <SortDropdown
                                value={sortValue}
                                onChange={handleSortChange}
                            />

                            {/* Legacy inline filters — only when neither the
                                old nor the v2 filter modal is flagged on. */}
                            {!filtersModalEnabled && (
                                <>
                                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                        Filter:
                                    </span>
                                    <Select
                                        value={locationId || undefined}
                                        onChange={(v) =>
                                            handleFilterChange(
                                                "location_id",
                                                v ?? "",
                                            )
                                        }
                                        placeholder="All Locations"
                                        allowClear
                                        options={filterLocations
                                            .filter((l) =>
                                                Boolean(l.name?.trim()),
                                            )
                                            .map((l) => ({
                                                value: String(l.id),
                                                label: formatLocationNameForDisplay(
                                                    l.name,
                                                ),
                                            }))}
                                        style={{ width: 160 }}
                                        size="small"
                                    />
                                    <Select
                                        value={developerId || undefined}
                                        onChange={(v) =>
                                            handleFilterChange(
                                                "developer_id",
                                                v ?? "",
                                            )
                                        }
                                        placeholder="All Developers"
                                        allowClear
                                        options={developers.map((d) => ({
                                            value: String(d.id),
                                            label: d.name,
                                        }))}
                                        style={{ width: 160 }}
                                        size="small"
                                    />
                                    <Select
                                        value={
                                            constructionStatus || undefined
                                        }
                                        onChange={(v) =>
                                            handleFilterChange(
                                                "construction_status",
                                                v ?? "",
                                            )
                                        }
                                        placeholder="Any Status"
                                        allowClear
                                        options={PROJECT_CONSTRUCTION_STATUSES.map(
                                            (s) => ({
                                                value: s.value,
                                                label: s.label,
                                            }),
                                        )}
                                        style={{ width: 180 }}
                                        size="small"
                                    />
                                    <Select
                                        value={primaryCategory || undefined}
                                        onChange={(v) =>
                                            handleFilterChange(
                                                "primary_category",
                                                v ?? "",
                                            )
                                        }
                                        placeholder="Any Category"
                                        allowClear
                                        options={primaryCategories.map(
                                            (c) => ({
                                                value: c.name,
                                                label: c.label,
                                            }),
                                        )}
                                        style={{ width: 150 }}
                                        size="small"
                                    />
                                    <Input
                                        value={paymentPlanDuration}
                                        onChange={(e) =>
                                            handlePaymentPlanDurationChange(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Plan months"
                                        size="small"
                                        style={{ width: 140 }}
                                        type="number"
                                        min={0}
                                    />
                                    <Input
                                        value={priceMin}
                                        onChange={(e) =>
                                            handlePriceChange(
                                                "price_min",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Min price"
                                        size="small"
                                        style={{ width: 110 }}
                                        type="number"
                                        min={0}
                                    />
                                    <span className="text-xs text-gray-400">
                                        –
                                    </span>
                                    <Input
                                        value={priceMax}
                                        onChange={(e) =>
                                            handlePriceChange(
                                                "price_max",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Max price"
                                        size="small"
                                        style={{ width: 110 }}
                                        type="number"
                                        min={0}
                                    />
                                    {hasActiveFilters && (
                                        <button
                                            onClick={handleClearFilters}
                                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-1"
                                        >
                                            <X size={12} />
                                            Clear filters
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    }
                    filtersCount={
                        filtersV2Enabled ? v2ActiveFilterCount : activeFilterCount
                    }
                    onOpenFilters={
                        filtersModalEnabled
                            ? () =>
                                  filtersV2Enabled
                                      ? filter.openDrawer()
                                      : setFiltersModalOpen(true)
                            : undefined
                    }
                    filterSentence={
                        filtersV2Enabled ? (
                            <ActiveFilterSentence
                                count={projects.total}
                                entityLabel="projects"
                                onOpenFilters={filter.openDrawer}
                            />
                        ) : undefined
                    }
                />

                <div className="min-h-screen bg-slate-50">
                    <div className="max-w-screen-2xl mx-auto px-7 py-7 pb-12">
                        {(projects.data ?? []).length === 0 ? (
                            <EmptyState
                                onAdd={canAdd ? handleAdd : undefined}
                            />
                        ) : (
                            <>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                                    {(projects.data ?? []).map((project) => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            showHiddenBadge={showHiddenBadge}
                                            onEdit={
                                                canEdit ? handleEdit : undefined
                                            }
                                            onDelete={
                                                canDelete
                                                    ? handleDelete
                                                    : undefined
                                            }
                                        />
                                    ))}
                                </div>

                                {projects.last_page > 1 && (
                                    <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
                                        <span className="text-sm text-gray-400">
                                            {projects.from}–{projects.to} of{" "}
                                            {projects.total} projects
                                        </span>
                                        <AntPagination
                                            current={projects.current_page}
                                            total={projects.total}
                                            pageSize={projects.per_page}
                                            onChange={goToPage}
                                            showSizeChanger={false}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </PageLayout>

            <ProjectFormModal
                open={projectFormOpen}
                onClose={() => {
                    setProjectFormOpen(false);
                    setSelectedProject(null);
                }}
                project={selectedProject}
                locations={locations}
                locationsLoading={locationsQuery.isLoading}
                onSuccess={handleSuccess}
                canToggleHidden={canToggleHidden}
            />

            {filtersV2Enabled ? (
                <EntityFilterModal
                    config={filterConfig}
                    entityLabel="projects"
                    currentCount={projects.total}
                    savedViews={true}
                    savedViewEntity="project"
                />
            ) : (
                filtersModalEnabled && (
                    <ProjectsFiltersModal
                        open={filtersModalOpen}
                        onClose={() => setFiltersModalOpen(false)}
                        onApply={applyModalFilters}
                        onReset={resetModalFilters}
                        initialValues={filterDraft}
                        developers={developers}
                        locations={filterLocations}
                        primaryCategories={primaryCategories}
                    />
                )
            )}
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
