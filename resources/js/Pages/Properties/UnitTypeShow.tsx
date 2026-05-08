import React, { useState } from "react";
import { message } from "antd";

import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import MarkAsSoldModal from "@/Features/Properties/MarkAsSoldModal";
import GenerateUnitTypeExposeModal from "@/Features/DeveloperProjects/GenerateUnitTypeExposeModal";

import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import UnitTypePropertyView from "@/Features/Properties/PropertyView/UnitTypePropertyView";
import useTranslation from "@/Hooks/useTranslation";

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
    soldCount: number;
    soldPropertyIds: number[];
    deals: DealOption[];
    employees: { id: number; name: string }[];
}

const UnitTypeShow = ({
    pageTitle,
    unitType,
    developerProject,
    mergedAssets,
    soldCount,
    soldPropertyIds,
    deals,
    employees,
}: UnitTypeShowProps) => {
    const { t } = useTranslation();
    const [showMarkAsSoldModal, setShowMarkAsSoldModal] = useState(false);
    const [showExposeModal, setShowExposeModal] = useState(false);
    const [currentSoldCount, setCurrentSoldCount] = useState(soldCount);
    const [currentSoldPropertyIds, setCurrentSoldPropertyIds] =
        useState<number[]>(soldPropertyIds);

    const breadcrumbs = [
        { name: t("app.menu.properties"), url: route("properties.index") },
        {
            name: unitType.display_label
                ? `${developerProject.name} — ${unitType.display_label}`
                : unitType.reference_code ||
                  `${t("pages.properties.unit_type_show.unit_type_reference_prefix")} #${unitType.id}`,
        },
    ];

    const handleCheckAvailability = () => {
        if (developerProject.availability_link) {
            window.open(developerProject.availability_link, "_blank");
        } else {
            message.info(
                t(
                    "pages.properties.unit_type_show.messages.no_availability_link",
                ),
            );
        }
    };

    const handleMarkAsSold = () => {
        setShowMarkAsSoldModal(true);
    };

    const handleMarkAsSoldSuccess = (propertyId: number) => {
        setCurrentSoldCount((prev) => prev + 1);
        setCurrentSoldPropertyIds((prev) => [propertyId, ...prev]);
        setShowMarkAsSoldModal(false);
    };

    return (
        <>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto">
                    <UnitTypePropertyView
                        unitType={unitType}
                        developerProject={developerProject}
                        mergedAssets={mergedAssets}
                        soldCount={currentSoldCount}
                        soldPropertyIds={currentSoldPropertyIds}
                        onCheckAvailability={handleCheckAvailability}
                        onMarkAsSold={handleMarkAsSold}
                        onGenerateExpose={() => setShowExposeModal(true)}
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
                    t("pages.properties.unit_type_show.unit_type_label")
                }
                projectName={developerProject.name}
                deals={deals}
                employees={employees}
                onSuccess={handleMarkAsSoldSuccess}
            />

            <GenerateUnitTypeExposeModal
                open={showExposeModal}
                onClose={() => setShowExposeModal(false)}
                projectId={developerProject.id}
                projectName={developerProject.name}
                unitType={unitType}
            />
        </>
    );
};

UnitTypeShow.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default UnitTypeShow;
