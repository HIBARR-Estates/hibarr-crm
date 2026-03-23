import React from "react";
import { Tag } from "antd";
import type { EnrollmentStatus } from "../types";
import { ENROLLMENT_STATUS_LABELS } from "../types";

const COLORS: Record<EnrollmentStatus, string> = {
    active: "green",
    extended: "orange",
    completed: "default",
    force_completed: "red",
};

interface Props {
    status: EnrollmentStatus;
}

const EnrollmentStatusBadge: React.FC<Props> = ({ status }) => (
    <Tag color={COLORS[status] ?? "default"}>
        {ENROLLMENT_STATUS_LABELS[status] ?? status}
    </Tag>
);

export default EnrollmentStatusBadge;
