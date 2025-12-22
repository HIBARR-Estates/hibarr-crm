import React from "react";
import { Avatar, Tooltip } from "antd";
import { UserOutlined } from "@ant-design/icons";
type AvatarSize = number | "small" | "default" | "large";

export type UserIndicatorSize = "xs" | "sm" | "default" | "lg" | "xl";

interface UserData {
    image_url?: string;
    image?: string;
    name?: string;
}

interface UserIndicatorProps {
    data: UserData;
    size?: UserIndicatorSize;
    showName?: boolean;
    namePosition?: "right" | "bottom";
    maxNameLength?: number;
    className?: string;
    showTooltip?: boolean;
    tooltipContent?: React.ReactNode;
}

const sizeMap: Record<
    UserIndicatorSize,
    {
        avatar: AvatarSize;
        nameClass: string;
        containerClass: string;
        maxLength: number;
    }
> = {
    xs: {
        avatar: 16,
        nameClass: "text-xs",
        containerClass: "gap-1",
        maxLength: 8,
    },
    sm: {
        avatar: 28,
        nameClass: "text-xs",
        containerClass: "gap-1.5",
        maxLength: 12,
    },
    default: {
        avatar: 32,
        nameClass: "text-sm",
        containerClass: "gap-2",
        maxLength: 16,
    },
    lg: {
        avatar: 40,
        nameClass: "text-base",
        containerClass: "gap-2.5",
        maxLength: 20,
    },
    xl: {
        avatar: 48,
        nameClass: "text-lg",
        containerClass: "gap-3",
        maxLength: 24,
    },
};

const UserIndicator: React.FC<UserIndicatorProps> = ({
    data,
    size = "default",
    showName = true,
    namePosition = "right",
    maxNameLength,
    className = "",
    showTooltip = true,
    tooltipContent,
}) => {
    const sizeConfig = sizeMap[size];
    const avatarImage = data?.image_url || data?.image;
    const userName = data?.name || "Unknown User";

    // Calculate max length for name truncation
    const effectiveMaxLength = maxNameLength || sizeConfig.maxLength;

    // Truncate name if needed
    const truncatedName =
        userName.length > effectiveMaxLength
            ? `${userName.substring(0, effectiveMaxLength)}...`
            : userName;

    // Base container classes based on name position
    const containerClasses =
        namePosition === "bottom"
            ? `flex flex-col items-center ${sizeConfig.containerClass}`
            : `flex items-center ${sizeConfig.containerClass}`;

    const avatar = (
        <Avatar
            size={sizeConfig.avatar}
            src={avatarImage}
            icon={<UserOutlined />}
            className="flex-shrink-0"
            style={{
                backgroundColor: avatarImage ? undefined : "#1890ff",
            }}
        >
            {!avatarImage && userName ? userName.charAt(0).toUpperCase() : null}
        </Avatar>
    );

    const nameElement = showName && (
        <span
            className={`${sizeConfig.nameClass} text-gray-700 font-medium ${
                namePosition === "bottom" ? "text-center" : "truncate"
            }`}
            style={{
                maxWidth: namePosition === "right" ? "150px" : "auto",
            }}
        >
            {truncatedName}
        </span>
    );

    const content = (
        <div className={`${containerClasses} ${className}`}>
            {avatar}
            {nameElement}
        </div>
    );

    // Show tooltip if enabled and there's content to show
    if (showTooltip && (tooltipContent || userName !== truncatedName)) {
        return (
            <Tooltip
                title={
                    tooltipContent ||
                    (userName !== truncatedName ? userName : null)
                }
                placement="top"
            >
                {content}
            </Tooltip>
        );
    }

    return content;
};

export default UserIndicator;
