import React, { useState } from "react";
import { router } from "@inertiajs/react";
import { Property } from "@/Types";

// Import components
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import { Button, Tooltip, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import PropertyView from "@/Features/Properties/PropertyView/PropertyView";
import { Task } from "@/Types/api/tasks";
import GenerateExposeModal from "@/Features/Properties/GenerateExposeModal";
import SavePropertyModal from "@/Features/Properties/SaveProperty/SavePropertyModal";
import { generatePropertySubtitle } from "@/lib/utils";
import usePageRefresh from "@/Hooks/usePageRefresh";

interface ShowProps {
    pageTitle: string;
    property: Property;
    hasPendingPublishRequest?: boolean;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}

const Show = ({
    pageTitle,
    property,
    hasPendingPublishRequest = false,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: ShowProps) => {
    // Breadcrumbs for the page
    const breadcrumbs = [
        {
            name: "Properties",
            url: route("properties.index"),
        },
        {
            name:
                generatePropertySubtitle(property) ||
                property.reference_code ||
                `Property #${property.id}`,
        },
    ];

    // State for modals
    const [showExposeModal, setShowExposeModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentProperty, setCurrentProperty] = useState<Property>(property);

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh();

    const handleEdit = () => {
        setShowEditModal(true);
    };

    const handleEditModalClose = () => {
        setShowEditModal(false);
    };

    const handlePropertyUpdate = (updatedProperty: Property | undefined) => {
        if (updatedProperty) {
            setCurrentProperty(updatedProperty);
        }
    };

    const handleShare = () => {
        // Copy property URL to clipboard
        const url = window.location.href;
        navigator.clipboard
            .writeText(url)
            .then(() => {
                message.success("Property link copied to clipboard!");
            })
            .catch(() => {
                message.error("Failed to copy link");
            });
    };

    const handleFavorite = () => {
        // This would typically make an API call to add/remove from favorites
        message.success("Property added to favorites!");
    };

    const handleBack = () => {
        router.visit(route("properties.index"));
    };

    return (
        <>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-end mb-4">
                        <Button
                            icon={<ReloadOutlined spin={isRefreshing} />}
                            onClick={refresh}
                            disabled={isRefreshing}
                            type="text"
                        >
                            Refresh
                        </Button>
                    </div>
                    <PropertyView
                        property={currentProperty}
                        hasPendingPublishRequest={hasPendingPublishRequest}
                        onEdit={handleEdit}
                        onShare={handleShare}
                        onGenerateExpose={() => setShowExposeModal(true)}
                        tasks={tasks}
                        taskCategories={taskCategories}
                        taskLabels={taskLabels}
                        taskBoardColumns={taskBoardColumns}
                        employees={employees}
                        projects={projects}
                    />
                </div>
            </PageLayout>

            <GenerateExposeModal
                open={showExposeModal}
                onClose={() => setShowExposeModal(false)}
                propertyId={currentProperty.id}
            />

            <SavePropertyModal
                open={showEditModal}
                onClose={handleEditModalClose}
                property={currentProperty}
                setProperty={handlePropertyUpdate}
            />
        </>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
