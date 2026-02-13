import React from "react";
import { Card, Row, Col } from "antd";
import { Property, PrimaryCategory } from "@/Types";
import TasksTab from "@/Components/TasksTab";
import { Task } from "@/Types/api/tasks";
import usePropertyPermissions from "@/Hooks/usePropertyPermissions";
import {
    CATEGORY_SECTIONS,
    CategorySections,
} from "@/Features/Properties/SaveProperty/fieldConfig";

import PropertyHeader from "./PropertyHeader";
import PropertyGallery from "./PropertyGallery";
import CoreDetailsCard from "./CoreDetailsCard";
import SpecificationsCard from "./SpecificationsCard";
import ClassificationCard from "./ClassificationCard";
import PropertyFeatures from "./PropertyFeatures";
import LegalFinancialInfo from "./LegalFinancialInfo";
import DocumentsViewCard from "./DocumentsViewCard";
import DescriptionMediaCard from "./DescriptionMediaCard";
import OwnerInfoCard from "./OwnerInfoCard";
import InternalInfoCard from "./InternalInfoCard";
import PropertyLocation from "./PropertyLocation";
import AgentInfoCard from "./AgentInfoCard";

interface PropertyViewProps {
    property: Property;
    onEdit?: () => void;
    onShare?: () => void;
    onGenerateExpose?: () => void;
    canEdit?: boolean;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}

export default function PropertyView({
    property,
    onEdit,
    onShare,
    onGenerateExpose,
    canEdit = false,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: PropertyViewProps) {
    // Centralised permission check — passed to children as props
    const permissions = usePropertyPermissions(property);

    // Determine section visibility per category
    const category =
        (property.primary_category as PrimaryCategory) || "residential";
    const sections: CategorySections =
        CATEGORY_SECTIONS[category] || CATEGORY_SECTIONS.residential;

    return (
        <div className="property-view">
            {/* Header — title, status, price, action buttons */}
            <PropertyHeader
                property={property}
                permissions={permissions}
                onEdit={onEdit}
                onShare={onShare}
                onGenerateExpose={onGenerateExpose}
            />

            {/* Photo gallery with lightbox */}
            <PropertyGallery
                property={property}
                canEdit={permissions.canEdit}
            />

            <Row gutter={[24, 16]}>
                {/* ─── Main Content ─── */}
                <Col xs={24} lg={16}>
                    <div className="flex flex-col gap-4">
                        {/* Core Details — always visible */}
                        {sections.coreDetails && (
                            <CoreDetailsCard property={property} />
                        )}

                        {/* Specifications */}
                        {sections.specifications && (
                            <SpecificationsCard property={property} />
                        )}

                        {/* Classification — hidden for land */}
                        {sections.classification && (
                            <ClassificationCard property={property} />
                        )}

                        {/* Features — hidden for land */}
                        {sections.features && (
                            <PropertyFeatures property={property} />
                        )}

                        {/* Legal & Financial */}
                        {sections.legalFinancial && (
                            <LegalFinancialInfo property={property} />
                        )}

                        {/* Documents — land only, permission-gated */}
                        {sections.documents &&
                            permissions.canViewDocuments && (
                                <DocumentsViewCard property={property} />
                            )}

                        {/* Description & Media */}
                        {sections.descriptionMedia && (
                            <DescriptionMediaCard property={property} />
                        )}

                        {/* Owner Info — permission-gated */}
                        {sections.ownerInfo && (
                            <OwnerInfoCard
                                property={property}
                                canViewOwnerInfo={permissions.canViewOwnerInfo}
                                canRequestAccess={permissions.canRequestAccess}
                                isSalesManager={permissions.isSalesManager}
                            />
                        )}

                        {/* Internal Info — permission-gated */}
                        {sections.internalInfo &&
                            permissions.canViewInternalInfo && (
                                <InternalInfoCard property={property} />
                            )}

                        {/* Tasks */}
                        <Card
                            title="Tasks"
                            variant="outlined"
                            size="small"
                        >
                            <TasksTab
                                tasks={tasks}
                                relatedEntity={{
                                    type: "property",
                                    id: property.id,
                                }}
                                taskCategories={taskCategories}
                                taskLabels={taskLabels}
                                taskBoardColumns={taskBoardColumns}
                                employees={employees}
                                projects={projects}
                            />
                        </Card>
                    </div>
                </Col>

                {/* ─── Sidebar ─── */}
                <Col xs={24} lg={8}>
                    <div className="flex flex-col gap-4">
                        <PropertyLocation property={property} />
                        <AgentInfoCard property={property} />
                    </div>
                </Col>
            </Row>
        </div>
    );
}
