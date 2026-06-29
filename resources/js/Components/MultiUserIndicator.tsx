import React from "react";
import { Avatar, Tooltip } from "antd";
import UserIndicator, { monogramColor, getInitials } from "./UserIndicator";
type AvatarSize = number | "small" | "default" | "large";

export type MultiUserIndicatorSize = "xs" | "sm" | "default" | "lg" | "xl";

interface UserData {
    id?: string | number;
    image_url?: string;
    image?: string;
    name?: string;
}

interface MultiUserIndicatorProps {
    users?: UserData[];
    size?: MultiUserIndicatorSize;
    maxCount?: number;
    className?: string;
    showTooltip?: boolean;
    tooltipPlacement?:
        | "top"
        | "bottom"
        | "left"
        | "right"
        | "topLeft"
        | "topRight"
        | "bottomLeft"
        | "bottomRight";
    showNames?: boolean;
    direction?: "horizontal" | "vertical";
    tooltipContent?: React.ReactNode;
    colorful?: boolean;
}

const sizeMap: Record<
    MultiUserIndicatorSize,
    {
        avatar: AvatarSize;
        fontSize: number;
        nameClass: string;
        spacing: string;
    }
> = {
    xs: {
        avatar: 16,
        fontSize: 6,
        nameClass: "text-xs",
        spacing: "-space-x-1",
    },
    sm: {
        avatar: 24,
        fontSize: 9,
        nameClass: "text-sm",
        spacing: "-space-x-1.5",
    },
    default: {
        avatar: 32,
        fontSize: 11,
        nameClass: "text-sm",
        spacing: "-space-x-2",
    },
    lg: {
        avatar: 40,
        fontSize: 13,
        nameClass: "text-base",
        spacing: "-space-x-2.5",
    },
    xl: {
        avatar: 48,
        fontSize: 16,
        nameClass: "text-lg",
        spacing: "-space-x-3",
    },
};

const MultiUserIndicator: React.FC<MultiUserIndicatorProps> = ({
    users = [],
    size = "default",
    maxCount = 4,
    className = "",
    showTooltip = true,
    tooltipPlacement = "top",
    showNames = true,
    direction = "horizontal",
    tooltipContent,
    colorful = false,
}) => {
    const sizeConfig = sizeMap[size];

    if (users.length === 0) {
        return null;
    }

    // If only one user, use UserIndicator component instead
    if (users.length === 1) {
        const user = users[0];
        return (
            <UserIndicator
                data={{
                    image_url: user.image_url,
                    image: user.image,
                    name: user.name,
                }}
                size={size}
                showName={showNames}
                namePosition={direction === "vertical" ? "bottom" : "right"}
                className={className}
                showTooltip={showTooltip}
                tooltipContent={tooltipContent}
                colorful={colorful}
            />
        );
    }


    // Generate avatars for Avatar.Group
    const avatarElements = users.map((user, index) => {
        const avatarImage = user.image_url || user.image;
        const userName = user.name || "Unknown User";

        const avatar = (
            <Avatar
                size={sizeConfig.avatar}
                src={avatarImage || undefined}
                style={{
                    backgroundColor: colorful ? monogramColor(userName) : "#1890ff",
                    border: "2px solid white",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: sizeConfig.fontSize,
                }}
            >
                {getInitials(userName)}
            </Avatar>
        );

        if (showTooltip) {
            return (
                <Tooltip key={user.id || index} title={userName} placement={tooltipPlacement}>
                    {avatar}
                </Tooltip>
            );
        }
        return <React.Fragment key={user.id || index}>{avatar}</React.Fragment>;
    });

    const avatarGroup = (
        <Avatar.Group
            max={{
                count: maxCount,
                style: {
                    color: "#1890ff",
                    backgroundColor: "#e6f4ff",
                    border: "2px solid white",
                    fontSize:
                        size === "xs"
                            ? "10px"
                            : size === "sm"
                            ? "12px"
                            : "14px",
                },
            }}
            size={sizeConfig.avatar}
            className={className}
        >
            {avatarElements}
        </Avatar.Group>
    );

    // Names list (if enabled)
    const namesList = showNames && (
        <div
            className={`${
                direction === "vertical" ? "mt-2" : "ml-3"
            } space-y-0.5`}
        >
            {users.slice(0, maxCount).map((user, index) => (
                <div
                    key={user.id || index}
                    className={`${sizeConfig.nameClass} text-gray-700`}
                >
                    {user.name || "Unknown User"}
                </div>
            ))}
            {users.length > maxCount && (
                <div className={`${sizeConfig.nameClass} text-gray-500`}>
                    +{users.length - maxCount} more
                </div>
            )}
        </div>
    );

    const content = (
        <div
            className={`flex ${
                direction === "vertical"
                    ? "flex-col items-center"
                    : "items-center"
            }`}
        >
            {avatarGroup}
            {namesList}
        </div>
    );

    return content;
};

export default MultiUserIndicator;
