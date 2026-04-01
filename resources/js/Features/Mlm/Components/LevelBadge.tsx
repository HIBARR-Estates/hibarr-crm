import React from "react";
import { Tag } from "antd";
import type { MlmLevel } from "../types";

const RANK_COLORS: Record<number, string> = {
    1: "#92400e", // Bronze
    2: "#57534e", // Silver
    3: "#a16207", // Gold
    4: "#4338ca", // Platinum
    5: "#0e7490", // Diamond
    6: "#15803d", // Emerald
    7: "#b91c1c", // Ruby
    8: "#7e22ce", // Amethyst
    9: "#0f172a", // Obsidian
    10: "#b45309", // Crown
};

const RANK_BG: Record<number, string> = {
    1: "bg-amber-50 border-amber-300",
    2: "bg-stone-50 border-stone-300",
    3: "bg-yellow-50 border-yellow-300",
    4: "bg-indigo-50 border-indigo-300",
    5: "bg-cyan-50 border-cyan-300",
    6: "bg-emerald-50 border-emerald-300",
    7: "bg-red-50 border-red-300",
    8: "bg-purple-50 border-purple-300",
    9: "bg-slate-100 border-slate-400",
    10: "bg-orange-50 border-orange-300",
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
