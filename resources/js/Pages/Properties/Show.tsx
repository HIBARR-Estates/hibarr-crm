import React, { useState } from "react";
import { router } from "@inertiajs/react";
import { Property } from "@/Types";

// Import components
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import { message } from "antd";
import PropertyView from "@/Features/Properties/PropertyView/PropertyView";
import { Task } from "@/Types/api/tasks";
import GenerateExposeModal from "@/Features/Properties/GenerateExposeModal";

interface ShowProps {
    pageTitle: string;
    property: Property;
    canEdit?: boolean;
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
    canEdit = false,
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
            name: property.title,
        },
    ];

    const handleEdit = () => {
        router.visit(route("properties.edit", property.id));
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

    const [showExposeModal, setShowExposeModal] = useState(false);

    return (
        <>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto">
                    <PropertyView
                        property={property}
                        onEdit={canEdit ? handleEdit : undefined}
                        onShare={handleShare}
                        onGenerateExpose={() => setShowExposeModal(true)}
                        canEdit={canEdit}
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
                propertyId={property.id}
            />
        </>
    );
}

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
