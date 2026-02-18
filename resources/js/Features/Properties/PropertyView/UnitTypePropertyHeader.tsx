import React from "react";
import { Typography, Tag, Space, Button, Tooltip, message } from "antd";
import {
    CopyOutlined,
    CheckCircleOutlined,
    DollarOutlined,
    EnvironmentOutlined,
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

const { Title, Text } = Typography;

interface UnitTypePropertyHeaderProps {
    unitType: DeveloperProjectUnitType;
    developerProject: DeveloperProject;
    isSold: boolean;
    soldPropertyId: number | null;
    onCheckAvailability: () => void;
    onMarkAsSold: () => void;
    onViewSoldProperty: () => void;
}

export default function UnitTypePropertyHeader({
    unitType,
    developerProject,
    isSold,
    soldPropertyId,
    onCheckAvailability,
    onMarkAsSold,
    onViewSoldProperty,
}: UnitTypePropertyHeaderProps) {
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
        location?.address?.city ?? location?.name,
        location?.address?.state,
    ]
        .filter(Boolean)
        .join(", ");

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

                {/* Status */}
                <Tag color={isSold ? "red" : "green"}>
                    {isSold ? "Sold" : "Available"}
                </Tag>
            </div>

            {/* Title */}
            <Title level={3} className="!mb-1">
                {unitType.display_label || "Unit Type"}
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
                        {cityArea}
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

                {/* Mark as Sold (only if not already sold) */}
                {!isSold && (
                    <Button
                        type="default"
                        icon={<ShoppingCartOutlined />}
                        onClick={onMarkAsSold}
                        className="border-orange-400 text-orange-600 hover:border-orange-500 hover:text-orange-700"
                    >
                        Mark as Sold
                    </Button>
                )}

                {/* View Sold Property (if already sold) */}
                {isSold && soldPropertyId && (
                    <Link href={route("properties.show", soldPropertyId)}>
                        <Button type="default" icon={<EyeOutlined />}>
                            View Sold Property
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
}
