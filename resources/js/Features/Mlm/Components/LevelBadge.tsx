import React from "react";
import { Tag } from "antd";
import type { MlmLevel } from "../types";

const RANK_COLORS: Record<number, string> = {
    1: "#cd7f32", // Bronze
    2: "#c0c0c0", // Silver
    3: "#ffd700", // Gold
    4: "#e5e4e2", // Platinum
    5: "#b9f2ff", // Diamond
};

const RANK_BG: Record<number, string> = {
    1: "bg-amber-50 border-amber-200",
    2: "bg-gray-50 border-gray-200",
    3: "bg-yellow-50 border-yellow-200",
    4: "bg-indigo-50 border-indigo-200",
    5: "bg-cyan-50 border-cyan-200",
};

interface LevelBadgeProps {
    level: MlmLevel | null | undefined;
    showPercentage?: boolean;
    size?: "small" | "default" | "large";
}

export default function LevelBadge({
    level,
    showPercentage = false,
    size = "default",
}: LevelBadgeProps) {
    if (!level) {
        return (
            <Tag color="default" className="rounded-full">
                No Level
            </Tag>
        );
    }

    const color = RANK_COLORS[level.rank] ?? "#8c8c8c";

    const fontSize =
        size === "small" ? "text-xs" : size === "large" ? "text-sm" : "text-xs";

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${fontSize} font-semibold ${RANK_BG[level.rank] ?? "bg-gray-50 border-gray-200"}`}
            style={{ color }}
        >
            <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
            />
            {level.name}
            {showPercentage && (
                <span className="text-gray-400 font-normal ml-1">
                    ({level.commission_percentage}%)
                </span>
            )}
        </span>
    );
}
