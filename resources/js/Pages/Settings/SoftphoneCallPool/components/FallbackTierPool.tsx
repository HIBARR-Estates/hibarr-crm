import React, { useMemo, useState } from "react";
import axios from "axios";
import { App } from "antd";
import { RightOutlined } from "@ant-design/icons";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { EligibleResponse, PoolAgent, PoolResponse, TierScope } from "../types";
import { findLowestAvailablePriority, POOL_GRID_STYLE } from "../utils";
import AgentPoolTable from "./AgentPoolTable";
import AddAgentInlineForm from "./AddAgentInlineForm";

interface FallbackTierPoolProps {
    tierScope: TierScope;
    title: string;
    tierBadge: string;
    description: string;
    emptyStateMessage: string;
    addLabel: string;
    placeholder: string;
}

/**
 * Unified, reusable Fallback Tier component (supports Tier 2 Default Fallback and Tier 3 Admin Fallback).
 */
export default function FallbackTierPool({
    tierScope,
    title,
    tierBadge,
    description,
    emptyStateMessage,
    addLabel,
    placeholder,
}: FallbackTierPoolProps) {
    const { message } = App.useApp();
    const [isOpen, setIsOpen] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedPriority, setSelectedPriority] = useState<number>(100);
    const [isAdding, setIsAdding] = useState(false);
    const [togglingActiveIds, setTogglingActiveIds] = useState<Record<number, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<PoolAgent | null>(null);

    const poolQuery = useApiQuery<PoolResponse>({
        path: route("telephony.softphone.call-pool.index", { scope: tierScope }),
        enabled: isOpen,
    });

    const eligibleQuery = useApiQuery<EligibleResponse>({
        path: route("telephony.softphone.call-pool.eligible", { scope: tierScope }),
        enabled: isOpen,
    });

    const agents = useMemo(() => poolQuery.data?.data?.agents ?? [], [poolQuery.data]);
    const eligibleUsers = useMemo(() => eligibleQuery.data?.data?.users ?? [], [eligibleQuery.data]);
    const usedPriorities = useMemo(() => new Set(agents.map((a) => a.priority)), [agents]);

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
                    scope: tierScope,
                    user_id: selectedUserId,
                    priority: selectedPriority,
                },
                { headers: { Accept: "application/json" } },
            );
            void message.success(`User added to ${title.toLowerCase()}.`);
            setSelectedUserId(null);
            await Promise.all([poolQuery.refetch(), eligibleQuery.refetch()]);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || `Could not add user to ${title.toLowerCase()}.`;
            void message.error(errorMessage);
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggleActive = async (agent: PoolAgent) => {
        setTogglingActiveIds((previous) => ({ ...previous, [agent.user_id]: true }));
        try {
            await axios.put(
                route("telephony.softphone.call-pool.update", agent.id),
                { active: !agent.active },
                { headers: { Accept: "application/json" } },
            );
            void message.success(!agent.active ? "Calls routed to this user." : "Calls paused for this user.");
            await poolQuery.refetch();
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || "Could not update routing status.";
            void message.error(errorMessage);
        } finally {
            setTogglingActiveIds((previous) => ({ ...previous, [agent.user_id]: false }));
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(route("telephony.softphone.call-pool.destroy", deleteTarget.id), {
                headers: { Accept: "application/json" },
            });
            void message.success(`User removed from ${title.toLowerCase()}.`);
            setDeleteTarget(null);
            await Promise.all([poolQuery.refetch(), eligibleQuery.refetch()]);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || "Could not remove user.";
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
                <span className="cb-group__name">{title}</span>
                <span className="cb-chip cb-chip--default">{tierBadge}</span>
                <span className="cb-group__count">
                    {agents.length} user{agents.length === 1 ? "" : "s"}
                </span>
            </summary>

            <p style={{ margin: "10px 0 12px", fontSize: "13px", color: "var(--dr-text-muted)", lineHeight: "1.5" }}>
                {description}
            </p>

            <div
                className="cb-table cb-pool"
                role="table"
                aria-label={`${title} users`}
                style={POOL_GRID_STYLE}
            >
                <div
                    className="cb-grid-row cb-grid-row--head cb-pool"
                    role="row"
                    style={POOL_GRID_STYLE}
                >
                    <span>User</span>
                    <span title="Order in which calls ring users in this tier (1 rings first, 2 rings second, etc.)">
                        Routing Order
                    </span>
                    <span title="Admins and managers can toggle this to pause calls routing to them">
                        Route Calls to Me
                    </span>
                    <span aria-hidden="true" style={{ textAlign: "right" }} />
                </div>

                <AgentPoolTable
                    agents={agents}
                    isLoading={poolQuery.isLoading}
                    emptyMessage={emptyStateMessage}
                    mode="fallback"
                    togglingUserIds={togglingActiveIds}
                    onToggleAccess={(agent) => void handleToggleActive(agent)}
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
                    placeholder={placeholder}
                    addLabel={addLabel}
                    onUserSelected={setSelectedUserId}
                    onPrioritySelected={setSelectedPriority}
                    onSubmit={() => void handleAdd()}
                />
            </div>

            <ConfirmDialog
                open={deleteTarget !== null}
                title={`Remove user from ${title.toLowerCase()}?`}
                message={deleteTarget ? `${deleteTarget.name ?? "This user"} will no longer receive fallback calls in this tier.` : ""}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                danger
                onConfirm={() => void handleConfirmDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </details>
    );
}
