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
    canEdit = false,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: PropertyViewProps) {
    // console.log("PropertyView Rendered", property);
    // Mock photos for demo (replace with actual property photos)
    const photos =
        property.photos && property.photos?.length > 0
            ? property.photos
            : [
                  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
                  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
                  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
              ];

    return (
        <div className="property-view">
            <PropertyHeader
                property={property}
                onEdit={onEdit}
                onShare={onShare}
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
