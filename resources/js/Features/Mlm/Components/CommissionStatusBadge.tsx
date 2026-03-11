import React from "react";
import { Tag } from "antd";
import type { MlmCommissionStatus } from "../types";

const STATUS_CONFIG: Record<
    MlmCommissionStatus,
    { color: string; label: string }
> = {
    pending: { color: "orange", label: "Pending" },
    paid: { color: "green", label: "Paid" },
    reverted: { color: "red", label: "Reverted" },
};

interface CommissionStatusBadgeProps {
    status: MlmCommissionStatus;
}

export default function CommissionStatusBadge({
    status,
}: CommissionStatusBadgeProps) {
    const config = STATUS_CONFIG[status] ?? {
        color: "default",
        label: status,
    };

    return <Tag color={config.color}>{config.label}</Tag>;
}
