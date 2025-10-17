import React from "react";
import { Card, Row, Col } from "antd";
import { Property } from "@/Types";
import PropertyImageGallery from "../PropertyImageGallery";
import PropertyStats from "../PropertyStats";
import AssetsTab from "../SaveProperty/AssetsTab";
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
}

export default function PropertyView({
    property,
    onEdit,
    onShare,
    canEdit = false,
}: PropertyViewProps) {
    // Mock photos for demo (replace with actual property photos)
    const photos =
        property.photos && property.photos?.length > 0
            ? property.photos
            : [
                  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
                  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
                  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
              ];

    const renderImageGallery = () => (
        <Card>
            <PropertyImageGallery images={photos} title={property.title} />
        </Card>
    );

    return (
        <div className="property-view">
            <PropertyHeader
                property={property}
                onEdit={onEdit}
                onShare={onShare}
                canEdit={canEdit}
            />
            
            {renderImageGallery()}

            <Row gutter={[24, 24]} className="mt-6">
                <Col xs={24} lg={16}>
                    <div className="space-y-6">
                        <PropertyDetails property={property} />
                        <PropertyStats property={property} />
                        <PropertyFeatures property={property} />
                        <PropertySpecifications property={property} />
                        <LegalFinancialInfo property={property} />
                        <PropertyMedia property={property} />
                        <AssetsTab property={property} canEdit={canEdit} />
                    </div>
                </Col>

                <Col xs={24} lg={8}>
                    <div className="space-y-6">
                        <PropertyLocation property={property} />
                        <ContactInfo property={property} />
                        <QuickFacts property={property} />
                    </div>
                </Col>
            </Row>
        </div>
    );
}
