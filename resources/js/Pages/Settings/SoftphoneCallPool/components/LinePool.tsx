import React, { useMemo, useState } from "react";
import axios from "axios";
import { App } from "antd";
import { RightOutlined } from "@ant-design/icons";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";
import type { EligibleResponse, PoolAgent, PoolResponse } from "../types";
import { findLowestAvailablePriority, POOL_GRID_STYLE } from "../utils";
import { usePermissionToggle } from "../hooks/usePermissionToggle";
import AgentPoolTable from "./AgentPoolTable";
import AddAgentInlineForm from "./AddAgentInlineForm";

interface LinePoolProps {
    device: SoftphoneDeviceSummary;
}

/**
 * Collapsible Tier 1 Line Pool card for a specific phone line.
 */
export default function LinePool({ device }: LinePoolProps) {
    const { message } = App.useApp();
    const [isOpen, setIsOpen] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedPriority, setSelectedPriority] = useState<number>(100);
    const [isAdding, setIsAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PoolAgent | null>(null);

    const poolQuery = useApiQuery<PoolResponse>({
        path: route("telephony.softphone.call-pool.index", { device_id: device.id }),
        enabled: isOpen,
    });

    const eligibleQuery = useApiQuery<EligibleResponse>({
        path: route("telephony.softphone.call-pool.eligible", { device_id: device.id }),
        enabled: isOpen,
    });

    const agents = useMemo(() => poolQuery.data?.data?.agents ?? [], [poolQuery.data]);
    const eligibleUsers = useMemo(() => eligibleQuery.data?.data?.users ?? [], [eligibleQuery.data]);
    const usedPriorities = useMemo(() => new Set(agents.map((a) => a.priority)), [agents]);

    const { togglingUserIds, togglePermission } = usePermissionToggle(
        () => poolQuery.refetch(),
        device.id,
    );

    React.useEffect(() => {
        if (!usedPriorities.has(100)) {
            setSelectedPriority(100);
        } else {
            setSelectedPriority(findLowestAvailablePriority(usedPriorities));
        }
    }, [usedPriorities]);

    const handleAdd = async () => {
        if (!selectedUserId) return;
        setIsAdding(true);
        try {
            await axios.post(
                route("telephony.softphone.call-pool.store"),
                {
                    device_id: device.id,
                    user_id: selectedUserId,
                    priority: selectedPriority,
                },
                { headers: { Accept: "application/json" } },
            );
            void message.success("Agent added to the line pool.");
            setSelectedUserId(null);
            await Promise.all([poolQuery.refetch(), eligibleQuery.refetch()]);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || "Could not add agent.";
            void message.error(errorMessage);
        } finally {
            setIsAdding(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(route("telephony.softphone.call-pool.destroy", deleteTarget.id), {
                headers: { Accept: "application/json" },
            });
            void message.success("Agent removed from line pool.");
            setDeleteTarget(null);
            await Promise.all([poolQuery.refetch(), eligibleQuery.refetch()]);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || "Could not remove agent.";
            void message.error(errorMessage);
        }
    };

    return (
        <details
            className="cb-group"
            open={isOpen}
            onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
        >
            <summary className="cb-summary">
                <RightOutlined className="cb-chev" aria-hidden="true" />
                <span className="cb-group__name">{device.label}</span>
                {device.phone_number && (
                    <span style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>
                        {device.phone_number}
                    </span>
                )}
                {device.is_default && <span className="cb-chip cb-chip--default">Default Line</span>}
                <span className="cb-group__count">
                    {agents.length} agent{agents.length === 1 ? "" : "s"}
                </span>
            </summary>

            <div
                className="cb-table cb-pool"
                role="table"
                aria-label={`${device.label} agents`}
                style={POOL_GRID_STYLE}
            >
                <div
                    className="cb-grid-row cb-grid-row--head cb-pool"
                    role="row"
                    style={POOL_GRID_STYLE}
                >
                    <span>Agent</span>
                    <span title="Order in which calls ring agents on this line (1 rings first, 2 rings second, etc.)">
                        Routing Order
                    </span>
                    <span title="Controls whether this agent has softphone access to receive calls on this line">
                        Softphone Access
                    </span>
                    <span aria-hidden="true" style={{ textAlign: "right" }} />
                </div>

                <AgentPoolTable
                    agents={agents}
                    isLoading={poolQuery.isLoading}
                    emptyMessage="No agents assigned to this line yet."
                    mode="line"
                    togglingUserIds={togglingUserIds}
                    onToggleAccess={(agent) => void togglePermission(agent.user_id, agent.active && Boolean(agent.has_permission))}
                    onRequestDelete={setDeleteTarget}
                    onPriorityUpdated={() => poolQuery.refetch()}
                />
            </div>

            <div className="cb-group__foot">
                <AddAgentInlineForm
                    eligibleUsers={eligibleUsers}
                    selectedUserId={selectedUserId}
                    selectedPriority={selectedPriority}
                    usedPriorities={usedPriorities}
                    isSubmitting={isAdding}
                    placeholder="Search active users"
                    addLabel={`Add agent to ${device.label}`}
                    onUserSelected={setSelectedUserId}
                    onPrioritySelected={setSelectedPriority}
                    onSubmit={() => void handleAdd()}
                />
            </div>

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Remove agent from pool?"
                message={deleteTarget ? `${deleteTarget.name ?? "This agent"} will no longer receive calls routed to this line.` : ""}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                danger
                onConfirm={() => void handleConfirmDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </details>
    );
}
