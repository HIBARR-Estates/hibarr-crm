import React, { useState } from "react";
import { Card, Button, List, Empty, Typography } from "antd";
import { FilePdfOutlined, LinkOutlined } from "@ant-design/icons";
import type { DeveloperProjectUnitType } from "../../../Types/developerProject";
import type { PriceListItem } from "../Show";
import ExposeGenerationModal from "../../../Features/DeveloperProjects/ExposeGenerationModal";
import GenerateUnitTypeExposeModal from "../../../Features/DeveloperProjects/GenerateUnitTypeExposeModal";
import GenerateProjectExposeModal from "../../../Features/DeveloperProjects/GenerateProjectExposeModal";
import ShareExposeLinkModal from "../../../Features/Expose/ShareExposeLinkModal";
import useExposeShareLinksFlag from "@/Hooks/useExposeShareLinksFlag";
import { snakeToReadable } from "../../../lib/utils";

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
    const shareLinksEnabled = useExposeShareLinksFlag();

    const [projectExposeModalOpen, setProjectExposeModalOpen] = useState(false);
    const [unitTypeExposeModalOpen, setUnitTypeExposeModalOpen] =
        useState(false);
    const [selectedUnitType, setSelectedUnitType] =
        useState<DeveloperProjectUnitType | null>(null);
    const [legacyModalOpen, setLegacyModalOpen] = useState(false);
    const [selectedPriceListItem, setSelectedPriceListItem] =
        useState<PriceListItem | null>(null);

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareEntity, setShareEntity] = useState<{
        entityType: "developer_project" | "unit_type";
        entityId: number;
        unitTypeId?: number;
        title: string;
        subtitle?: string;
    } | null>(null);

    const handleGenerateUnitTypeExpose = (ut: DeveloperProjectUnitType) => {
        setSelectedUnitType(ut);
        setUnitTypeExposeModalOpen(true);
    };

    const handleShareUnitType = (ut: DeveloperProjectUnitType) => {
        setShareEntity({
            entityType: "unit_type",
            entityId: projectId,
            unitTypeId: ut.id,
            title:
                ut.display_label ??
                snakeToReadable(ut.property_type) ??
                "Unit Type",
            subtitle: projectName,
        });
        setShareModalOpen(true);
    };

    const handleShareProject = () => {
        setShareEntity({
            entityType: "developer_project",
            entityId: projectId,
            title: projectName,
        });
        setShareModalOpen(true);
    };

    const handleOpenLegacyModal = (item: PriceListItem) => {
        setSelectedPriceListItem(item);
        setLegacyModalOpen(true);
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                {shareLinksEnabled ? (
                    <Card
                        title="Project exposé"
                        extra={
                            <Button
                                size="small"
                                type="primary"
                                icon={<LinkOutlined />}
                                onClick={handleShareProject}
                            >
                                Share link
                            </Button>
                        }
                    >
                        <Paragraph className="text-gray-600 mb-0">
                            Create a personalized shareable link for the full
                            project exposé, including overview, unit types,
                            facilities, and location details.
                        </Paragraph>
                    </Card>
                ) : null}

                {/* Project-level brochure PDF — hidden while share links are enabled */}
                {!shareLinksEnabled ? (
                    <>
                        {/* <Card
                    title="Project Brochure"
                    extra={
                        <Button
                            size="small"
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
                </Card> */}
                    </>
                ) : null}

                <Card title={shareLinksEnabled ? "Unit Exposes" : "Unit Expose PDFs"}>
                    {unitTypes.length === 0 ? (
                        <Empty
                            description={
                                shareLinksEnabled
                                    ? "No unit types yet. Add unit types to share exposés."
                                    : "No unit types defined. Add unit types to generate individual expose PDFs."
                            }
                        />
                    ) : (
                        <>
                            <Paragraph className="mb-4 text-gray-600">
                                {shareLinksEnabled
                                    ? "Create a personalized shareable link for each unit type. The link opens the digital exposé for the selected lead."
                                    : "Generate an expose PDF for each unit type. Each PDF uses the property expose template, inheriting project-level data where needed."}
                            </Paragraph>
                            <List
                                dataSource={unitTypes}
                                renderItem={(ut) => (
                                    <List.Item
                                        actions={[
                                            shareLinksEnabled ? (
                                                <Button
                                                    key="share"
                                                    size="small"
                                                    type="primary"
                                                    icon={<LinkOutlined />}
                                                    onClick={() =>
                                                        handleShareUnitType(ut)
                                                    }
                                                >
                                                    Share link
                                                </Button>
                                            ) : (
                                                <Button
                                                    key="generate"
                                                    size="small"
                                                    icon={<FilePdfOutlined />}
                                                    onClick={() =>
                                                        handleGenerateUnitTypeExpose(
                                                            ut,
                                                        )
                                                    }
                                                >
                                                    Generate Expose
                                                </Button>
                                            ),
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                ut.display_label ??
                                                snakeToReadable(
                                                    ut.property_type,
                                                ) ??
                                                "Unit Type"
                                            }
                                            description={[
                                                ut.formatted_price,
                                                ut.bedrooms
                                                    ? `${ut.bedrooms} bed`
                                                    : null,
                                                ut.bathrooms
                                                    ? `${ut.bathrooms} bath`
                                                    : null,
                                                ut.living_area_sqm
                                                    ? `${ut.living_area_sqm} sqm`
                                                    : null,
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
                {/* {priceList.length > 0 && (
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
                                        title={snakeToReadable(item.type)}
                                        description={`${item.count} properties`}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                )} */}
            </div>

            {!shareLinksEnabled && (
                <>
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
            )}

            {shareLinksEnabled && shareEntity && (
                <ShareExposeLinkModal
                    open={shareModalOpen}
                    onClose={() => {
                        setShareModalOpen(false);
                        setShareEntity(null);
                    }}
                    entityType={shareEntity.entityType}
                    entityId={shareEntity.entityId}
                    unitTypeId={shareEntity.unitTypeId}
                    title={shareEntity.title}
                    subtitle={shareEntity.subtitle}
                />
            )}
        </>
    );
};

export default PdfFilesSection;
