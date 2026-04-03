import React from "react";
import { Progress, Typography } from "antd";
import type { CriterionProgress, MlmLevel } from "../types";
import { MLM_METRIC_LABELS } from "../types";
import LevelBadge from "./LevelBadge";

const { Text, Title } = Typography;

interface ProgressToNextLevelProps {
    currentLevel: MlmLevel | null;
    nextLevel: MlmLevel | null;
    overallProgress: number;
    criteriaProgress: CriterionProgress[];
    compact?: boolean;
}

export default function ProgressToNextLevel({
    currentLevel,
    nextLevel,
    overallProgress,
    criteriaProgress,
    compact = false,
}: ProgressToNextLevelProps) {
    if (!nextLevel) {
        return (
            <div className="text-center py-4">
                <div className="text-2xl mb-2">🏆</div>
                <Text type="secondary">Maximum level reached!</Text>
            </div>
        );
    }

    const progressColor =
        overallProgress >= 100
            ? "#52c41a"
            : overallProgress >= 75
              ? "#1890ff"
              : overallProgress >= 50
                ? "#faad14"
                : "#ff4d4f";

    return (
        <div className={compact ? "space-y-2" : "space-y-4"}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Text
                        type="secondary"
                        className="text-xs uppercase tracking-wider"
                    >
                        Progress to
                    </Text>
                    <LevelBadge level={nextLevel} />
                </div>
                <Text strong className="text-lg">
                    {Math.round(overallProgress)}%
                </Text>
            </div>

            {/* Overall Progress Bar */}
            <Progress
                percent={Math.min(overallProgress, 100)}
                strokeColor={progressColor}
                trailColor="#f0f0f0"
                showInfo={false}
                size={compact ? "small" : "default"}
                className="mb-2"
            />

            {/* Individual Criteria Progress */}
            {!compact && criteriaProgress.length > 0 && (
                <div className="space-y-3 mt-4">
                    <Text
                        type="secondary"
                        className="text-xs uppercase tracking-wider"
                    >
                        Requirements
                    </Text>
                    {criteriaProgress.map((cp, index) => (
                        <div key={index} className="space-y-1">
                            <div className="flex items-center justify-between">
                                <Text className="text-sm">
                                    {cp.criterion.description ? (
                                        cp.criterion.description
                                    ) : (
                                        <>
                                            {MLM_METRIC_LABELS[
                                                cp.criterion.metric
                                            ] ?? cp.criterion.metric}{" "}
                                            <Text type="secondary">
                                                {cp.criterion.operator}{" "}
                                                {cp.criterion.threshold.toLocaleString()}
                                            </Text>
                                        </>
                                    )}
                                </Text>
                                <Text
                                    className="text-sm"
                                    type={cp.met ? "success" : undefined}
                                >
                                    {cp.current_value.toLocaleString()} /{" "}
                                    {cp.target_value.toLocaleString()}
                                    {cp.met && " ✓"}
                                </Text>
                            </div>
                            <Progress
                                percent={Math.min(cp.percentage, 100)}
                                strokeColor={cp.met ? "#52c41a" : "#1890ff"}
                                trailColor="#f0f0f0"
                                showInfo={false}
                                size="small"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
