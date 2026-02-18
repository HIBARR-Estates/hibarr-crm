import React, { useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";

import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
// import UnitTypePropertyView from "@/Features/Properties/PropertyView/UnitTypePropertyView";
import MarkAsSoldModal from "@/Features/Properties/MarkAsSoldModal";

import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import UnitTypePropertyView from "@/Features/Properties/PropertyView/UnitTypePropertyView";

interface MergedAsset {
    id: number | string;
    url: string;
    name: string | null;
    asset_type: string;
    tags: string[];
    source: "unit_type" | "project";
    order: number;
}

interface DealOption {
    id: number;
    name: string;
    contact_name: string;
}

interface UnitTypeShowProps {
    pageTitle: string;
    unitType: DeveloperProjectUnitType;
    developerProject: DeveloperProject;
    mergedAssets: MergedAsset[];
    isSold: boolean;
    soldPropertyId: number | null;
    deals: DealOption[];
    employees: { id: number; name: string }[];
}

const UnitTypeShow = ({
    pageTitle,
    unitType,
    developerProject,
    mergedAssets,
    isSold,
    soldPropertyId,
    deals,
    employees,
}: UnitTypeShowProps) => {
    const [showMarkAsSoldModal, setShowMarkAsSoldModal] = useState(false);
    const [currentIsSold, setCurrentIsSold] = useState(isSold);
    const [currentSoldPropertyId, setCurrentSoldPropertyId] =
        useState(soldPropertyId);

    const breadcrumbs = [
        { name: "Properties", url: route("properties.index") },
        {
            name: unitType.display_label
                ? `${developerProject.name} — ${unitType.display_label}`
                : unitType.reference_code || `Unit Type #${unitType.id}`,
        },
    ];

    const handleCheckAvailability = () => {
        if (developerProject.availability_link) {
            window.open(developerProject.availability_link, "_blank");
        } else {
            message.info("No availability link configured for this project.");
        }
    };

    const handleMarkAsSold = () => {
        setShowMarkAsSoldModal(true);
    };

    const handleMarkAsSoldSuccess = (propertyId: number) => {
        setCurrentIsSold(true);
        setCurrentSoldPropertyId(propertyId);
        setShowMarkAsSoldModal(false);
    };

    const handleViewSoldProperty = () => {
        if (currentSoldPropertyId) {
            router.visit(route("properties.show", currentSoldPropertyId));
        }
    };

    return (
        <>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto">
                    <UnitTypePropertyView
                        unitType={unitType}
                        developerProject={developerProject}
                        mergedAssets={mergedAssets}
                        isSold={currentIsSold}
                        soldPropertyId={currentSoldPropertyId}
                        onCheckAvailability={handleCheckAvailability}
                        onMarkAsSold={handleMarkAsSold}
                        onViewSoldProperty={handleViewSoldProperty}
                    />
                </div>
            </PageLayout>

            <MarkAsSoldModal
                open={showMarkAsSoldModal}
                onClose={() => setShowMarkAsSoldModal(false)}
                unitTypeId={unitType.id}
                unitTypeLabel={
                    unitType.display_label ||
                    unitType.reference_code ||
                    "Unit Type"
                }
                projectName={developerProject.name}
                deals={deals}
                employees={employees}
                onSuccess={handleMarkAsSoldSuccess}
            />
        </>
    );
};

UnitTypeShow.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default UnitTypeShow;
