import { useState, useCallback, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { router } from "@inertiajs/react";
import { Link } from "@inertiajs/react";
import { MapPin, ArrowLeft } from "lucide-react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import type { PageProps } from "../../Components/DashboardLayout";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
    ProjectLocation,
    DeveloperProjectExposeConfig,
    Developer,
} from "../../Types/developerProject";
import type { Property } from "../../Types";
import UnitTypesSection from "../../Features/DeveloperProjects/UnitTypesSection";
import ConstructionProjectFormModal from "../../Features/DeveloperProjects/ConstructionProjectFormModal";
import ProjectPhotosSection from "../../Features/DeveloperProjects/ProjectPhotosSection";
import ShowSidebar from "./components/ShowSidebar";
import OverviewSection from "./components/OverviewSection";
import FacilitiesSection from "./components/FacilitiesSection";
import ImageGallerySection from "./components/ImageGallerySection";
import PriceListSection from "./components/PriceListSection";
import PdfFilesSection from "./components/PdfFilesSection";
import DevelopersSection from "./components/DevelopersSection";
import ProjectOffersSection from "../../Features/Offers/ProjectOffersSection";

// ============================================
// Types
// ============================================

export interface UnitTypeSummary {
    type: string;
    quantity: number;
    bedrooms: { min: number | null; max: number | null };
    bathrooms: { min: number | null; max: number | null };
    area: { min: number | null; max: number | null };
    price: { min: number | null; max: number | null };
}

export interface Statistics {
    total_units: number;
    sold_properties: number;
    under_offer_properties: number;
    starting_price: number | null;
    starting_price_formatted: string | null;
}

export interface ImageItem {
    id: number;
    url: string;
    name: string;
    source: "project" | "property";
    property_id?: number;
    property_title?: string;
}

export interface PriceListItem {
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

export interface UnitTypePriceListItem {
    type: string;
    count: number;
    min_price: number | null;
    max_price: number | null;
    currency: string;
    currency_symbol: string;
    unit_types: Array<{
        id: number;
        reference_code: string | null;
        starting_price: number | null;
        formatted_price: string | null;
        currency: string;
        currency_symbol: string;
        bedrooms: number | null;
        bathrooms: number | null;
        floor: string | null;
        total_area_sqm: number | null;
        quantity: number | null;
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
    unitTypesSummary: UnitTypeSummary[];
    facilities: { name: string; label: string; icon: string | null }[];
    imagesByTag: Record<string, ImageItem[]>;
    priceList: PriceListItem[];
    unitTypePriceList: UnitTypePriceListItem[];
    unitTypes: DeveloperProjectUnitType[];
    developerProjects: DeveloperProject[];
}

export type SectionKey =
    | "overview"
    | "developers"
    | "unit_types"
    | "photos"
    | "facilities"
    | "exterior"
    | "interior"
    | "siteplan"
    | "pricelist"
    | "pdf"
    | "offers";

// ============================================
// Error Boundary
// ============================================

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class PageErrorBoundary extends Component<
    { children: ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("DeveloperProjects/Show crashed:", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 border border-red-200 rounded-lg m-4">
                    <h2 className="text-red-700 font-bold text-lg mb-2">
                        Page Error
                    </h2>
                    <pre className="text-red-600 text-sm whitespace-pre-wrap">
                        {this.state.error?.message}
                        {"\n\n"}
                        {this.state.error?.stack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

// ============================================
// Main Component
// ============================================

const Show = ({
    pageTitle,
    project,
    statistics,
    unitTypesSummary,
    facilities,
    imagesByTag,
    priceList,
    unitTypePriceList,
    unitTypes,
    developerProjects,
}: ShowProps) => {
    const [activeSection, setActiveSection] = useState<SectionKey>("overview");
    const [editModalOpen, setEditModalOpen] = useState(false);

    const handleEditSuccess = useCallback(() => {
        router.reload();
    }, []);

    const renderSection = () => {
        switch (activeSection) {
            case "overview":
                return (
                    <OverviewSection
                        project={project}
                        statistics={statistics}
                        unitTypesSummary={unitTypesSummary}
                        imagesByTag={imagesByTag}
                    />
                );
            case "developers":
                return (
                    <DevelopersSection
                        developer={project.developer}
                        developerProjects={developerProjects}
                        googleDriveLink={project.google_drive_link}
                        availabilityLink={project.availability_link}
                    />
                );
            case "unit_types":
                return (
                    <UnitTypesSection
                        projectId={project.id}
                        unitTypes={unitTypes ?? []}
                    />
                );
            case "photos":
                return <ProjectPhotosSection projectId={project.id} />;
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
                return <PriceListSection priceList={unitTypePriceList} />;
            case "pdf":
                return (
                    <PdfFilesSection
                        projectId={project.id}
                        projectName={project.name}
                        unitTypes={unitTypes}
                        priceList={priceList}
                    />
                );
            case "offers":
                return (
                    <ProjectOffersSection
                        project={project}
                        unitTypes={unitTypes ?? []}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <PageErrorBoundary>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    {
                        name: "Projects",
                        url: route("developer-projects.index"),
                    },
                    { name: project.name },
                ]}
            >
                {/* ── Project identity header — always visible across tabs ── */}
                <div className="mb-5 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-3 mb-1">
                        <Link
                            href={route("developer-projects.index")}
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                        >
                            <ArrowLeft size={14} />
                            <span>Back</span>
                        </Link>
                        <span className="text-gray-300">|</span>
                        <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                            {project.name}
                        </h1>
                    </div>
                    {project.developer && (
                        <p className="text-sm text-gray-500 ml-[calc(14px+0.25rem+1px+0.75rem+1px+0.75rem)] mb-0.5 ">
                            by{" "}
                            <Link
                                href={route(
                                    "developers.show",
                                    project.developer.id,
                                )}
                                className="text-blue-600 hover:text-blue-800 font-medium capitalize"
                            >
                                {project.developer.name}
                            </Link>
                        </p>
                    )}
                    {project.location?.name && (
                        <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5 capitalize">
                            <MapPin size={14} className="text-gray-400" />
                            {project.location.name}
                        </p>
                    )}
                </div>

                <div className="flex gap-6">
                    <ShowSidebar
                        activeSection={activeSection}
                        onSelect={setActiveSection}
                        onEdit={() => setEditModalOpen(true)}
                        availabilityLink={project.availability_link}
                        unitTypesCount={unitTypes?.length || 0}
                        exteriorCount={imagesByTag.exterior?.length || 0}
                        interiorCount={imagesByTag.interior?.length || 0}
                        siteplanCount={
                            (imagesByTag["floor-plan"]?.length || 0) +
                            (imagesByTag["site-plan"]?.length || 0)
                        }
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">{renderSection()}</div>
                </div>

                <ConstructionProjectFormModal
                    open={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    project={project}
                    onSuccess={handleEditSuccess}
                />
            </PageLayout>
        </PageErrorBoundary>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
