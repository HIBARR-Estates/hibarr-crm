import React, { useState } from "react";
import { Card, Button, List, Empty, Typography } from "antd";
import { FilePdfOutlined } from "@ant-design/icons";
import type { DeveloperProjectUnitType } from "../../../Types/developerProject";
import type { PriceListItem } from "../Show";
import ExposeGenerationModal from "../../../Features/DeveloperProjects/ExposeGenerationModal";
import GenerateUnitTypeExposeModal from "../../../Features/DeveloperProjects/GenerateUnitTypeExposeModal";
import GenerateProjectExposeModal from "../../../Features/DeveloperProjects/GenerateProjectExposeModal";

const { Paragraph } = Typography;

interface PdfFilesSectionProps {
    projectId: number;
    projectName: string;
    unitTypes: DeveloperProjectUnitType[];
    priceList: PriceListItem[];
}

const PdfFilesSection: React.FC<PdfFilesSectionProps> = ({
    projectId,
    projectName,
    unitTypes,
    priceList,
}) => {
    const [projectExposeModalOpen, setProjectExposeModalOpen] = useState(false);
    const [unitTypeExposeModalOpen, setUnitTypeExposeModalOpen] = useState(false);
    const [selectedUnitType, setSelectedUnitType] = useState<DeveloperProjectUnitType | null>(null);
    const [legacyModalOpen, setLegacyModalOpen] = useState(false);
    const [selectedPriceListItem, setSelectedPriceListItem] = useState<PriceListItem | null>(null);

    const handleGenerateUnitTypeExpose = (ut: DeveloperProjectUnitType) => {
        setSelectedUnitType(ut);
        setUnitTypeExposeModalOpen(true);
    };

    const handleOpenLegacyModal = (item: PriceListItem) => {
        setSelectedPriceListItem(item);
        setLegacyModalOpen(true);
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                {/* Project-level brochure */}
                <Card
                    title="Project Brochure"
                    extra={
                        <Button
                            type="primary"
                            icon={<FilePdfOutlined />}
                            onClick={() => setProjectExposeModalOpen(true)}
                        >
                            Generate Project Brochure
                        </Button>
                    }
                >
                    <Paragraph className="text-gray-600 mb-0">
                        Generate a full project brochure PDF including project overview, unit type
                        summaries, facilities, payment plan and infrastructure distances.
                    </Paragraph>
                </Card>

                {/* Unit type exposes */}
                <Card title="Unit Type Expose PDFs">
                    {unitTypes.length === 0 ? (
                        <Empty description="No unit types defined. Add unit types to generate individual expose PDFs." />
                    ) : (
                        <>
                            <Paragraph className="mb-4 text-gray-600">
                                Generate an expose PDF for each unit type. Each PDF uses the property
                                expose template, inheriting project-level data where needed.
                            </Paragraph>
                            <List
                                dataSource={unitTypes}
                                renderItem={(ut) => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                key="generate"
                                                type="primary"
                                                icon={<FilePdfOutlined />}
                                                onClick={() => handleGenerateUnitTypeExpose(ut)}
                                            >
                                                Generate Expose
                                            </Button>,
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={ut.display_label ?? ut.property_type ?? "Unit Type"}
                                            description={[
                                                ut.formatted_price,
                                                ut.bedrooms ? `${ut.bedrooms} bed` : null,
                                                ut.bathrooms ? `${ut.bathrooms} bath` : null,
                                                ut.living_area_sqm ? `${ut.living_area_sqm} sqm` : null,
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        />
                                    </List.Item>
                                )}
                            />
                        </>
                    )}
                </Card>

                {/* Legacy property-based expose */}
                {priceList.length > 0 && (
                    <Card
                        title="Property-based Expose (Legacy)"
                        className="border-dashed border-gray-300"
                    >
                        <Paragraph className="mb-4 text-gray-500 text-sm">
                            Generate expose PDFs based on assigned properties. This is the legacy
                            method — use unit type exposes above for new projects.
                        </Paragraph>
                        <List
                            size="small"
                            dataSource={priceList}
                            renderItem={(item) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            key="generate"
                                            size="small"
                                            icon={<FilePdfOutlined />}
                                            onClick={() => handleOpenLegacyModal(item)}
                                        >
                                            Generate
                                        </Button>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={item.type}
                                        description={`${item.count} properties`}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                )}
            </div>

            <GenerateProjectExposeModal
                open={projectExposeModalOpen}
                onClose={() => setProjectExposeModalOpen(false)}
                projectId={projectId}
                projectName={projectName}
            />

            {selectedUnitType && (
                <GenerateUnitTypeExposeModal
                    open={unitTypeExposeModalOpen}
                    onClose={() => {
                        setUnitTypeExposeModalOpen(false);
                        setSelectedUnitType(null);
                    }}
                    projectId={projectId}
                    projectName={projectName}
                    unitType={selectedUnitType}
                />
            )}

            {selectedPriceListItem && (
                <ExposeGenerationModal
                    open={legacyModalOpen}
                    onClose={() => {
                        setLegacyModalOpen(false);
                        setSelectedPriceListItem(null);
                    }}
                    projectId={projectId}
                    projectName={projectName}
                    priceListItem={selectedPriceListItem}
                />
            )}
        </>
    );
};

export default PdfFilesSection;
