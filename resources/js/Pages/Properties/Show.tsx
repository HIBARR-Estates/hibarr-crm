import React from "react";
import { router } from "@inertiajs/react";
import { Property } from "@/Types";

// Import components
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import PropertyView from "../../Components/Properties/PropertyView";
import { message } from "antd";

interface ShowProps {
    pageTitle: string;
    property: Property;
    canEdit?: boolean;
}

export default function Show({
    pageTitle,
    property,
    canEdit = false,
}: ShowProps) {
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

    return (
        <DashboardLayout>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto">
                    <PropertyView
                        property={property}
                        onEdit={canEdit ? handleEdit : undefined}
                        onShare={handleShare}
                        canEdit={canEdit}
                    />
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
