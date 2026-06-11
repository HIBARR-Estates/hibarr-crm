import React from "react";
import { Progress } from "antd";
import { Segment } from "@/Types/qualification";

interface BranchProgressBarProps {
    visibleSegments: Segment[];
    currentIndex: number;
    branchLabel?: string;
}

const BranchProgressBar: React.FC<BranchProgressBarProps> = ({
    visibleSegments,
    currentIndex,
    branchLabel,
}) => {
    const total = visibleSegments.length;
    const step = currentIndex >= 0 ? currentIndex + 1 : 1;
    const percent = total > 0 ? Math.round((step / total) * 100) : 0;

    return (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium text-gray-700">
                    {branchLabel ? `Branch: ${branchLabel}` : "Qualification progress"}
                </span>
                <span className="text-gray-500">
                    Step {step} of {total}
                </span>
            </div>
            <Progress
                percent={percent}
                showInfo={false}
                strokeColor="#2563eb"
                size="small"
            />
        </div>
    );
};

export default BranchProgressBar;
