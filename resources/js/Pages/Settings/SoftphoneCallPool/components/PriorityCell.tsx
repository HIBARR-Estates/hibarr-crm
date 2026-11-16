import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { App, Tooltip } from "antd";
import { CheckOutlined, CloseOutlined, EditOutlined } from "@ant-design/icons";

interface PriorityCellProps {
    agentId: number;
    initialPriority: number;
    otherPriorities: number[];
    onUpdated: () => Promise<unknown>;
}

/**
 * Click-to-edit routing priority pill with validation against duplicates.
 */
export default function PriorityCell({
    agentId,
    initialPriority,
    otherPriorities,
    onUpdated,
}: PriorityCellProps) {
    const { message } = App.useApp();
    const [isEditing, setIsEditing] = useState(false);
    const [priorityValue, setPriorityValue] = useState<string>(String(initialPriority));
    const [isSaving, setIsSaving] = useState(false);
    const inputReference = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setPriorityValue(String(initialPriority));
    }, [initialPriority]);

    useEffect(() => {
        if (isEditing) {
            inputReference.current?.focus();
            inputReference.current?.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        const parsedPriority = Number.parseInt(priorityValue, 10);
        if (!Number.isFinite(parsedPriority) || parsedPriority < 1 || parsedPriority > 100) {
            void message.error("Priority must be a number between 1 and 100.");
            setPriorityValue(String(initialPriority));
            setIsEditing(false);
            return;
        }

        if (parsedPriority === initialPriority) {
            setIsEditing(false);
            return;
        }

        if (otherPriorities.includes(parsedPriority)) {
            void message.error(`Priority ${parsedPriority} is already assigned to another agent in this pool.`);
            setPriorityValue(String(initialPriority));
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            await axios.put(
                route("telephony.softphone.call-pool.update", agentId),
                { priority: parsedPriority },
                { headers: { Accept: "application/json" } },
            );
            void message.success("Priority updated.");
            setIsEditing(false);
            await onUpdated();
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || "Could not update priority.";
            void message.error(errorMessage);
            setPriorityValue(String(initialPriority));
        } finally {
            setIsSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <input
                    ref={inputReference}
                    type="number"
                    min={1}
                    max={100}
                    className="cb-input cb-num"
                    style={{
                        width: "56px",
                        padding: "2px 6px",
                        fontSize: "12px",
                        height: "26px",
                        textAlign: "center",
                    }}
                    value={priorityValue}
                    onChange={(e) => setPriorityValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSave();
                        if (e.key === "Escape") {
                            setPriorityValue(String(initialPriority));
                            setIsEditing(false);
                        }
                    }}
                    disabled={isSaving}
                    aria-label="Edit routing priority"
                />
                <button
                    type="button"
                    className="cb-btn cb-btn--ghost cb-btn--sm"
                    style={{ padding: "3px 6px", minWidth: "unset", height: "26px" }}
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    title="Save (Enter)"
                    aria-label="Save priority"
                >
                    <CheckOutlined style={{ color: "var(--dr-green, #10b981)", fontSize: "11px" }} />
                </button>
                <button
                    type="button"
                    className="cb-btn cb-btn--ghost cb-btn--sm"
                    style={{ padding: "3px 6px", minWidth: "unset", height: "26px" }}
                    onClick={() => {
                        setPriorityValue(String(initialPriority));
                        setIsEditing(false);
                    }}
                    disabled={isSaving}
                    title="Cancel (Esc)"
                    aria-label="Cancel priority edit"
                >
                    <CloseOutlined style={{ color: "var(--dr-text-muted)", fontSize: "11px" }} />
                </button>
            </div>
        );
    }

    return (
        <Tooltip title="Click to edit routing order (1–100)">
            <button
                type="button"
                className="cb-prio cb-num"
                onClick={() => setIsEditing(true)}
                style={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "3px 12px",
                    borderRadius: "999px",
                    border: "1px solid var(--dr-border)",
                    background: "var(--dr-surface-2)",
                    color: "var(--dr-text)",
                    fontWeight: 600,
                    fontSize: "13px",
                    transition: "all 0.15s ease",
                    outline: "none",
                }}
                aria-label={`Routing priority ${initialPriority}, click to edit`}
            >
                <span>{initialPriority}</span>
                <EditOutlined style={{ fontSize: "11px", opacity: 0.5 }} aria-hidden="true" />
            </button>
        </Tooltip>
    );
}
