import React from "react";
import { Card, Row, Col } from "antd";
import { Property } from "@/Types";
import PropertyImageGallery from "../PropertyImageGallery";
import PropertyStats from "../PropertyStats";
import AssetsTab from "../SaveProperty/AssetsTab";
import TasksTab from "@/Components/TasksTab";
import { Task } from "@/Types/api/tasks";
import {
    PropertyHeader,
    PropertyDetails,
    PropertyFeatures,
    PropertySpecifications,
    LegalFinancialInfo,
    PropertyLocation,
    PropertyMedia,
    ContactInfo,
    QuickFacts,
} from "./index";

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
    // Get image assets from the new PropertyAsset system
    const imageAssets = property.assets?.filter(asset => asset.asset_type === 'image') || [];
    const photos = imageAssets.map(asset => asset.url).filter((url): url is string => !!url);

    return (
        <div className="property-view">
            <PropertyHeader
                property={property}
                onEdit={onEdit}
                onShare={onShare}
                onGenerateExpose={onGenerateExpose}
                canEdit={canEdit}
            />

            <Card variant="outlined">
                <PropertyImageGallery images={photos} title={property.title} />
            </Card>

            <Row gutter={[24, 24]} className="mt-6">
                <Col xs={24} lg={16}>
                    <div className="flex flex-col gap-4">
                        <PropertyDetails property={property} />
                        <PropertyStats property={property} />
                        <PropertyFeatures property={property} />
                        <PropertySpecifications property={property} />
                        <PropertyMedia property={property} />
                        <LegalFinancialInfo property={property} />
                        <AssetsTab property={property} canEdit={canEdit} />
                        <Card
                            title="Tasks Related to this Property"
                            variant="outlined"
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

                <Col xs={24} lg={8}>
                    <div className="flex flex-col gap-4">
                        <PropertyLocation property={property} />
                        {/* <ContactInfo property={property} /> */}
                        <QuickFacts property={property} />
                    </div>
                </Col>
            </Row>
        </div>
    );
}
