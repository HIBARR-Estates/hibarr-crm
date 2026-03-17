import React from "react";
import { Tag } from "antd";
import type { CycleStatus } from "../types";
import { CYCLE_STATUS_LABELS } from "../types";

const COLORS: Record<CycleStatus, string> = {
    active: "green",
    upcoming: "blue",
    completed: "default",
};

interface Props {
    status: CycleStatus;
}

const CycleStatusBadge: React.FC<Props> = ({ status }) => (
    <Tag color={COLORS[status] ?? "default"}>
        {CYCLE_STATUS_LABELS[status] ?? status}
    </Tag>
);

export default CycleStatusBadge;
