import React from "react";
import { Typography, Tag, Space, Button, Tooltip, message } from "antd";
import {
    CopyOutlined,
    CheckCircleOutlined,
    DollarOutlined,
    EnvironmentOutlined,
    FilePdfOutlined,
    LinkOutlined,
    ShoppingCartOutlined,
    EyeOutlined,
    BlockOutlined,
} from "@ant-design/icons";
import { Link } from "@inertiajs/react";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import UnitSoldOutBadge from "@/Components/UnitSoldOutBadge";
import { generatePropertySubtitle, formatLocationNameForDisplay } from "@/lib/utils";
import useExposeShareLinksFlag from "@/Hooks/useExposeShareLinksFlag";

const { Title, Text } = Typography;

interface UnitTypePropertyHeaderProps {
    unitType: DeveloperProjectUnitType;
    developerProject: DeveloperProject;
    soldCount: number;
    soldPropertyIds: number[];
    onCheckAvailability: () => void;
    onMarkAsSold: () => void;
    onGenerateExpose?: () => void;
}

export default function UnitTypePropertyHeader({
    unitType,
    developerProject,
    soldCount,
    soldPropertyIds,
    onCheckAvailability,
    onMarkAsSold,
    onGenerateExpose,
}: UnitTypePropertyHeaderProps) {
    const shareLinksEnabled = useExposeShareLinksFlag();
    const [copied, setCopied] = React.useState(false);

    const handleCopyRefCode = () => {
        if (unitType.reference_code) {
            navigator.clipboard.writeText(unitType.reference_code).then(() => {
                setCopied(true);
                message.success("Reference code copied!");
                setTimeout(() => setCopied(false), 2000);
            });
        }
    };

    const location = developerProject.location;
    const cityArea = [
        location?.city ?? location?.address?.city ?? location?.name,
        location?.area ?? location?.address?.city ?? location?.address?.state,
    ]
        .filter(Boolean)
        .join(", ");

    // Generate subtitle using the same util as the property table.
    // Unit types satisfy SubtitleableRecord directly — just supply city/area from the project location.
    const subtitle = generatePropertySubtitle({
        ...unitType,
        construction_status: developerProject.construction_status,
        city:
            location?.city ?? location?.address?.city ?? location?.name ?? null,
        area:
            location?.area ??
            location?.address?.city ??
            location?.address?.state ??
            null,
    });

    // Format price
    const currencySymbol = unitType.currency_symbol || "£";
    const formattedPrice =
        unitType.formatted_price ||
        (unitType.starting_price
            ? `${currencySymbol}${Number(unitType.starting_price).toLocaleString()}`
            : null);

    return (
        <div className="mb-6">
            {/* Source badge + Reference code */}
            <div className="flex items-center gap-3 mb-2">
                <Tag color="purple" icon={<BlockOutlined />}>
                    Unit Type
                </Tag>

                {unitType.reference_code && (
                    <Tooltip title={copied ? "Copied!" : "Click to copy"}>
                        <Tag
                            className="cursor-pointer select-none"
                            onClick={handleCopyRefCode}
                            icon={
                                copied ? (
                                    <CheckCircleOutlined />
                                ) : (
                                    <CopyOutlined />
                                )
                            }
                        >
                            {unitType.reference_code}
                        </Tag>
                    </Tooltip>
                )}

                <UnitSoldOutBadge soldOut={unitType.is_sold_out} />

                {/* Status */}
                {soldCount > 0 ? (
                    <Tag color="blue">{soldCount} Sold</Tag>
                ) : (
                    <Tag color="green">Available</Tag>
                )}
            </div>

            {/* Title */}
            <Title level={3} className="!mb-1">
                <span className="capitalize">
                    {subtitle || unitType.display_label || "Unit Type"}
                </span>
            </Title>

            {/* Project name */}
            <Text type="secondary" className="text-base">
                {developerProject.name}
                {developerProject.developer && (
                    <span className="ml-1">
                        by {developerProject.developer.name}
                    </span>
                )}
            </Text>

            {/* Location + Price row */}
            <div className="flex flex-wrap items-center gap-6 mt-3 text-base text-gray-600">
                {cityArea && (
                    <span className="flex items-center gap-1">
                        <EnvironmentOutlined />
                        {formatLocationNameForDisplay(cityArea)}
                    </span>
                )}

                {formattedPrice && (
                    <span className="flex items-center gap-1 font-semibold text-gray-900">
                        <DollarOutlined />
                        From {formattedPrice}
                    </span>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
                {/* Check Availability */}
                {developerProject.availability_link && (
                    <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        onClick={onCheckAvailability}
                    >
                        Check Availability
                    </Button>
                )}

                {/* Generate Expose / Share exposé */}
                {onGenerateExpose && (
                    <Button
                        type={shareLinksEnabled ? "primary" : "default"}
                        icon={
                            shareLinksEnabled ? (
                                <LinkOutlined />
                            ) : (
                                <FilePdfOutlined />
                            )
                        }
                        onClick={onGenerateExpose}
                    >
                        {shareLinksEnabled
                            ? "Share exposé"
                            : "Generate Expose"}
                    </Button>
                )}

                {/* Mark as Sold — always available since unit types support recurring sales */}
                {/* deprecated */}
                {/* <Button
                    type="default"
                    icon={<ShoppingCartOutlined />}
                    onClick={onMarkAsSold}
                    className="border-orange-400 text-orange-600 hover:border-orange-500 hover:text-orange-700"
                >
                    Mark as Sold
                </Button> */}

                {/* View Sold Properties */}
                {soldPropertyIds.map((propId, idx) => (
                    <Link key={propId} href={route("properties.show", propId)}>
                        <Button
                            type="default"
                            icon={<EyeOutlined />}
                            size="small"
                        >
                            {soldPropertyIds.length === 1
                                ? "View Sold Property"
                                : `Sold Property #${idx + 1}`}
                        </Button>
                    </Link>
                ))}
            </div>
        </div>
    );
}
