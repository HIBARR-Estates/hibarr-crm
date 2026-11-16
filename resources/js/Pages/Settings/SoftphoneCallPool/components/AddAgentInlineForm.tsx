import React, { useMemo, useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { InputNumber, Select } from "antd";
import type { EligibleUser } from "../types";

interface AddAgentInlineFormProps {
    eligibleUsers: EligibleUser[];
    selectedUserId: number | null;
    selectedPriority: number;
    usedPriorities: Set<number>;
    isSubmitting: boolean;
    placeholder: string;
    addLabel: string;
    onUserSelected: (userId: number | null) => void;
    onPrioritySelected: (priority: number) => void;
    onSubmit: () => Promise<void> | void;
}

/**
 * Inline expandable form for adding an eligible agent with routing order to a pool.
 */
export default function AddAgentInlineForm({
    eligibleUsers,
    selectedUserId,
    selectedPriority,
    usedPriorities,
    isSubmitting,
    placeholder,
    addLabel,
    onUserSelected,
    onPrioritySelected,
    onSubmit,
}: AddAgentInlineFormProps) {
    const [isPicking, setIsPicking] = useState(false);

    const userOptions = useMemo(() => {
        return eligibleUsers.map((user) => ({
            value: user.id,
            label: user.name + (user.email ? ` (${user.email})` : ""),
        }));
    }, [eligibleUsers]);

    const handleCancel = () => {
        setIsPicking(false);
        onUserSelected(null);
    };

    const handleSubmit = async () => {
        await onSubmit();
        setIsPicking(false);
    };

    if (!isPicking) {
        return (
            <button
                type="button"
                className="cb-btn cb-btn--ghost"
                onClick={() => setIsPicking(true)}
            >
                <PlusOutlined aria-hidden="true" />
                {addLabel}
            </button>
        );
    }

    return (
        <div className="cb-add-row">
            <div className="cb-field">
                <label>User</label>
                <Select
                    showSearch
                    style={{ width: "100%" }}
                    placeholder={placeholder}
                    aria-label="User"
                    optionFilterProp="label"
                    value={selectedUserId ?? undefined}
                    onChange={(val) => onUserSelected(typeof val === "number" ? val : null)}
                    options={userOptions}
                    notFoundContent="All eligible users are already in the pool."
                    allowClear
                />
            </div>
            <div className="cb-field" style={{ width: "120px", flexShrink: 0 }}>
                <label title="Order this agent will ring (1–100)">Routing Order</label>
                <InputNumber
                    min={1}
                    max={100}
                    style={{ width: "100%", height: "32px" }}
                    aria-label="Routing Order"
                    value={selectedPriority}
                    onChange={(val) => onPrioritySelected(val ?? 1)}
                />
            </div>
            <button
                type="button"
                className="cb-btn cb-btn--primary"
                disabled={!selectedUserId || isSubmitting}
                onClick={() => void handleSubmit()}
            >
                {isSubmitting ? "Adding…" : "Add"}
            </button>
            <button type="button" className="cb-btn" onClick={handleCancel}>
                Cancel
            </button>
        </div>
    );
}
