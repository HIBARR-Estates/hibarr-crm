import { useState, useCallback, useEffect, useRef } from "react";
import { Link, router } from "@inertiajs/react";
import { Button, Input, Pagination as AntPagination } from "antd";
import { Plus, MapPin, Search, Building2, Users } from "lucide-react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
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

// ============================================
// Types
// ============================================

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
    filters?:
        | {
              search?: string;
              sort?: string;
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 size={52} className="text-gray-200 mb-4" strokeWidth={1.5} />
            <p className="text-base font-semibold text-gray-500 mb-1">No projects found</p>
            <p className="text-sm text-gray-400 mb-5">
                Create your first construction project to get started.
            </p>
            <Button type="primary" icon={<Plus size={14} />} onClick={onAdd}>
                New Project
            </Button>
        </div>
    );
}

// ============================================
// Main Page
// ============================================

const Index = ({ pageTitle, projects: rawProjects, filters: rawFilters }: IndexProps) => {
    // Normalise server data — Laravel serialises empty arrays/objects inconsistently.
    // An empty PHP array arrives as `[]` in JSON; we must treat it as `{}`.
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

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] =
        useState<DeveloperProject | null>(null);
    const [projectToDelete, setProjectToDelete] =
        useState<DeveloperProject | null>(null);
    const [search, setSearch] = useState(safeFilters.search ?? "");
    const [sortValue, setSortValue] = useState(safeFilters.sort ?? "newest");
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Debounced search → server reload
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => {
            router.get(
                route("developer-projects.index"),
                { search: value, sort: sortValue },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 380);
    };

    // Sort change → server reload
    const handleSortChange = (value: string) => {
        setSortValue(value);
        router.get(
            route("developer-projects.index"),
            { search, sort: value },
            { preserveState: true, preserveScroll: true, replace: true },
        );
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
            { search, sort: sortValue, page },
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Projects" }]}
            >
                <div className="-m-6 min-h-screen bg-slate-50">
                    {/* ── Sticky header ── */}
                    <div className="bg-white border-b border-gray-200 px-7 py-3.5 sticky top-0 z-[100]">
                        <div className="max-w-screen-xl mx-auto">
                            {/* Row 1: title + search */}
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2.5">
                                <div className="flex items-baseline gap-2.5">
                                    <span className="text-[22px] font-bold text-slate-900">Projects</span>
                                    <span className="text-sm text-gray-400 font-normal">{projects.total}</span>
                                </div>
                                <Input
                                    value={search}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    placeholder="Search projects…"
                                    prefix={<Search size={14} className="text-gray-400" />}
                                    className="w-56"
                                    allowClear
                                />
                            </div>

                            {/* Row 2: actions + sort */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    type="primary"
                                    icon={<Plus size={14} />}
                                    onClick={handleAdd}
                                >
                                    New Project
                                </Button>

                                <Link href={route("project-locations.index")}>
                                    <Button icon={<MapPin size={14} />}>
                                        Manage Locations
                                    </Button>
                                </Link>

                                <Link href={route("developers.index")}>
                                    <Button icon={<Users size={14} />}>Developers</Button>
                                </Link>

                                <div className="ml-auto">
                                    <SortDropdown value={sortValue} onChange={handleSortChange} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Card grid ── */}
                    <div className="max-w-screen-xl mx-auto px-7 py-7 pb-12">
                        {(projects.data ?? []).length === 0 ? (
                            <EmptyState onAdd={handleAdd} />
                        ) : (
                            <>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                                    {(projects.data ?? []).map((project) => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>

                                {projects.last_page > 1 && (
                                    <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
                                        <span className="text-sm text-gray-400">
                                            {projects.from}–{projects.to} of {projects.total} projects
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

