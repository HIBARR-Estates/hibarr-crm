import React from "react";
import { Avatar, Tooltip } from "antd";
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
    colorful?: boolean;
}

const MONOGRAM_PALETTE = [
    "#4338ca",
    "#be185d",
    "#0369a1",
    "#047857",
    "#b45309",
    "#b91c1c",
    "#6d28d9",
];

export function monogramColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return MONOGRAM_PALETTE[Math.abs(hash) % MONOGRAM_PALETTE.length];
}

export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

const sizeMap: Record<
    UserIndicatorSize,
    {
        avatar: AvatarSize;
        fontSize: number;
        nameClass: string;
        containerClass: string;
        maxLength: number;
    }
> = {
    xs: {
        avatar: 16,
        fontSize: 6,
        nameClass: "text-xs",
        containerClass: "gap-1",
        maxLength: 8,
    },
    sm: {
        avatar: 28,
        fontSize: 10,
        nameClass: "text-xs",
        containerClass: "gap-1.5",
        maxLength: 12,
    },
    default: {
        avatar: 32,
        fontSize: 11,
        nameClass: "text-sm",
        containerClass: "gap-2",
        maxLength: 16,
    },
    lg: {
        avatar: 40,
        fontSize: 13,
        nameClass: "text-base",
        containerClass: "gap-2.5",
        maxLength: 20,
    },
    xl: {
        avatar: 48,
        fontSize: 16,
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
    colorful = false,
}) => {
    const sizeConfig = sizeMap[size];
    const avatarImage = data?.image_url || data?.image;
    const userName = data?.name || "Unknown User";

    const effectiveMaxLength = maxNameLength || sizeConfig.maxLength;

    const truncatedName =
        userName.length > effectiveMaxLength
            ? `${userName.substring(0, effectiveMaxLength)}...`
            : userName;

    const containerClasses =
        namePosition === "bottom"
            ? `flex flex-col items-center ${sizeConfig.containerClass}`
            : `flex items-center ${sizeConfig.containerClass}`;

    const avatar = (
        <Avatar
            size={sizeConfig.avatar}
            src={avatarImage || undefined}
            className="flex-shrink-0"
            style={{
                backgroundColor: colorful ? monogramColor(userName) : "#1890ff",
                color: "#fff",
                fontWeight: 700,
                fontSize: sizeConfig.fontSize,
            }}
        >
            {getInitials(userName)}
        </Avatar>
    );

    const nameElement = showName && (
        <span
            className={`${sizeConfig.nameClass} text-gray-700 font-semibold ${
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
