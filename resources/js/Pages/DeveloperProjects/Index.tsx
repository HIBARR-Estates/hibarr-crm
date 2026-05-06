import { useState, useCallback, useEffect, useRef } from "react";
import { Link, router } from "@inertiajs/react";
import { Button, Input, Pagination as AntPagination, Select } from "antd";
import { Plus, MapPin, Search, Building2, Users, X } from "lucide-react";
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
import { usePermission } from "@/lib/permissionUtils";

// ============================================
// Types
// ============================================

interface LookupOption {
    name: string;
    label: string;
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
    locations: Array<{ id: number; name: string }>;
    constructionStatuses: LookupOption[];
    primaryCategories: LookupOption[];
    filters?:
        | {
              search?: string;
              sort?: string;
              location_id?: string;
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
                <Button type="primary" icon={<Plus size={14} />} onClick={onAdd}>
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
}: IndexProps) => {
    // Normalise server data — Laravel serialises empty arrays/objects inconsistently.
    // An empty PHP array arrives as `[]` in JSON; we must treat it as `{}`.
    const safeFilters =
        rawFilters && !Array.isArray(rawFilters) ? rawFilters : {};
    const projects: PaginationData = rawProjects ?? {
        data: [],
        current_page: 1,
        last_page: 1,
        per_page: 12,
        total: 0,
        from: 0,
        to: 0,
    };

    const { t } = useTranslation();
    const { hasPermission } = usePermission();
    const canAdd = hasPermission("add_developer_projects");
    const canEdit = hasPermission("edit_developer_projects");
    const canDelete = hasPermission("delete_developer_projects");
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] =
        useState<DeveloperProject | null>(null);
    const [projectToDelete, setProjectToDelete] =
        useState<DeveloperProject | null>(null);
    const [search, setSearch] = useState(safeFilters.search ?? "");
    const [sortValue, setSortValue] = useState(safeFilters.sort ?? "newest");
    const [locationId, setLocationId] = useState(safeFilters.location_id ?? "");
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
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const priceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Locations — only loaded when modal is open
    const locationsQuery = useApiQuery<LocationsResponse>({
        path: route("project-locations.all"),
        options: { enabled: modalOpen },
    });
    const locations = locationsQuery.data?.locations ?? [];

    // Delete mutation
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

    // Build a params object from all current filter state
    const buildParams = (overrides: Record<string, string> = {}) => {
        const base: Record<string, string> = {};
        if (search) base.search = search;
        if (sortValue && sortValue !== "newest") base.sort = sortValue;
        if (locationId) base.location_id = locationId;
        if (developerId) base.developer_id = developerId;
        if (constructionStatus) base.construction_status = constructionStatus;
        if (primaryCategory) base.primary_category = primaryCategory;
        if (paymentPlanDuration) base.payment_plan_duration = paymentPlanDuration;
        if (priceMin) base.price_min = priceMin;
        if (priceMax) base.price_max = priceMax;
        const merged = { ...base, ...overrides };
        // Remove empty values
        Object.keys(merged).forEach((k) => {
            if (!merged[k]) delete merged[k];
        });
        return merged;
    };

    // Debounced search → server reload
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => {
            router.get(
                route("developer-projects.index"),
                buildParams({ search: value }),
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 380);
    };

    // Sort change → server reload
    const handleSortChange = (value: string) => {
        setSortValue(value);
        router.get(
            route("developer-projects.index"),
            buildParams({ sort: value }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const handlePriceChange = (key: "price_min" | "price_max", value: string) => {
        if (key === "price_min") setPriceMin(value);
        else setPriceMax(value);
        if (priceDebounce.current) clearTimeout(priceDebounce.current);
        priceDebounce.current = setTimeout(() => {
            router.get(
                route("developer-projects.index"),
                buildParams({ [key]: value }),
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 380);
    };

    const handleFilterChange = (key: string, value: string) => {
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
            case "payment_plan_duration":
                setPaymentPlanDuration(value);
                break;
        }
        router.get(
            route("developer-projects.index"),
            buildParams({ [key]: value }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const hasActiveFilters = !!(
        locationId ||
        developerId ||
        constructionStatus ||
        primaryCategory ||
        paymentPlanDuration ||
        priceMin ||
        priceMax
    );

    const handleClearFilters = () => {
        setLocationId("");
        setDeveloperId("");
        setConstructionStatus("");
        setPrimaryCategory("");
        setPaymentPlanDuration("");
        setPriceMin("");
        setPriceMax("");
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (sortValue && sortValue !== "newest") params.sort = sortValue;
        router.get(route("developer-projects.index"), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleAdd = () => {
        setSelectedProject(null);
        setModalOpen(true);
    };

    const handleEdit = useCallback((project: DeveloperProject) => {
        setSelectedProject(project);
        setModalOpen(true);
    }, []);

    const handleDelete = useCallback((project: DeveloperProject) => {
        setProjectToDelete(project);
    }, []);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["projects"] });
    }, []);

    const goToPage = (page: number) => {
        router.get(
            route("developer-projects.index"),
            { ...buildParams(), page: String(page) },
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: t("app.menu.projects") }]}
            >
                <div className="-m-6 min-h-screen bg-slate-50">
                    {/* ── Sticky header ── */}
                    <div className="bg-white border-b border-gray-200 px-7 py-3.5 sticky top-0 z-[100]">
                        <div className="max-w-screen-xl mx-auto">
                            {/* Row 1: title + search */}
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2.5">
                                <div className="flex items-baseline gap-2.5">
                                    <span className="text-[22px] font-bold text-slate-900">
                                        Projects
                                    </span>
                                    <span className="text-sm text-gray-400 font-normal">
                                        {projects.total}
                                    </span>
                                </div>
                                <Input
                                    value={search}
                                    onChange={(e) =>
                                        handleSearchChange(e.target.value)
                                    }
                                    placeholder="Search projects…"
                                    prefix={
                                        <Search
                                            size={14}
                                            className="text-gray-400"
                                        />
                                    }
                                    className="w-56"
                                    allowClear
                                />
                            </div>

                            {/* Row 2: actions + sort */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {canAdd && (
                                    <Button
                                        type="primary"
                                        icon={<Plus size={14} />}
                                        onClick={handleAdd}
                                    >
                                        New Project
                                    </Button>
                                )}

                                <Link href={route("project-locations.index")}>
                                    <Button icon={<MapPin size={14} />}>
                                        Manage Locations
                                    </Button>
                                </Link>

                                <Link href={route("developers.index")}>
                                    <Button icon={<Users size={14} />}>
                                        Developers
                                    </Button>
                                </Link>

                                <div className="ml-auto">
                                    <SortDropdown
                                        value={sortValue}
                                        onChange={handleSortChange}
                                    />
                                </div>
                            </div>

                            {/* Row 3: filters */}
                            <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-gray-100 mt-2.5">
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
                                        .filter((l) => Boolean(l.name?.trim()))
                                        .map((l) => ({
                                            value: String(l.id),
                                            label: l.name,
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
                                    value={constructionStatus || undefined}
                                    onChange={(v) =>
                                        handleFilterChange(
                                            "construction_status",
                                            v ?? "",
                                        )
                                    }
                                    placeholder="Any Status"
                                    allowClear
                                    options={constructionStatuses.map((s) => ({
                                        value: s.name,
                                        label: s.label,
                                    }))}
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
                                    options={primaryCategories.map((c) => ({
                                        value: c.name,
                                        label: c.label,
                                    }))}
                                    style={{ width: 150 }}
                                    size="small"
                                />
                                <Select
                                    value={paymentPlanDuration || undefined}
                                    onChange={(v) =>
                                        handleFilterChange(
                                            "payment_plan_duration",
                                            v ?? "",
                                        )
                                    }
                                    placeholder="Any Duration"
                                    allowClear
                                    options={[
                                        { value: "12", label: "12 months" },
                                        { value: "24", label: "24 months" },
                                        { value: "36", label: "36 months" },
                                        { value: "48", label: "48 months" },
                                        { value: "60", label: "60 months" },
                                        { value: "72", label: "72 months" },
                                        { value: "84", label: "84 months" },
                                        { value: "120", label: "120 months" },
                                    ]}
                                    style={{ width: 140 }}
                                    size="small"
                                />
                                <Input
                                    value={priceMin}
                                    onChange={(e) =>
                                        handlePriceChange("price_min", e.target.value)
                                    }
                                    placeholder="Min price"
                                    size="small"
                                    style={{ width: 110 }}
                                    type="number"
                                    min={0}
                                />
                                <span className="text-xs text-gray-400">–</span>
                                <Input
                                    value={priceMax}
                                    onChange={(e) =>
                                        handlePriceChange("price_max", e.target.value)
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
                            </div>
                        </div>
                    </div>

                    {/* ── Card grid ── */}
                    <div className="max-w-screen-xl mx-auto px-7 py-7 pb-12">
                        {(projects.data ?? []).length === 0 ? (
                            <EmptyState onAdd={canAdd ? handleAdd : undefined} />
                        ) : (
                            <>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                                    {(projects.data ?? []).map((project) => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            onEdit={canEdit ? handleEdit : undefined}
                                            onDelete={canDelete ? handleDelete : undefined}
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
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedProject(null);
                }}
                project={selectedProject}
                locations={locations}
                locationsLoading={locationsQuery.isLoading}
                onSuccess={handleSuccess}
            />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
