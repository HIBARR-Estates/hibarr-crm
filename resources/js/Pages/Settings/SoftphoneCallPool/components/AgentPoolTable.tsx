import React from "react";
import { DeleteOutlined, InfoCircleOutlined } from "@ant-design/icons";
import Switch from "@/Components/Redesign/primitives/Switch";
import type { PoolAgent } from "../types";
import { getInitials, POOL_GRID_STYLE } from "../utils";
import PriorityCell from "./PriorityCell";

interface AgentPoolTableProps {
    agents: PoolAgent[];
    isLoading: boolean;
    emptyMessage: string;
    mode?: "line" | "fallback";
    togglingUserIds: Record<number, boolean>;
    onToggleAccess: (agent: PoolAgent) => void;
    onRequestDelete: (agent: PoolAgent) => void;
    onPriorityUpdated: () => Promise<unknown>;
}

/**
 * Shared tabular list of pool agents across Line and Fallback tiers.
 */
export default function AgentPoolTable({
    agents,
    isLoading,
    emptyMessage,
    mode = "line",
    togglingUserIds,
    onToggleAccess,
    onRequestDelete,
    onPriorityUpdated,
}: AgentPoolTableProps) {
    if (isLoading) {
        return <div className="cb-empty">Loading…</div>;
    }

    if (agents.length === 0) {
        return <div className="cb-empty">{emptyMessage}</div>;
    }

    return (
        <>
            {agents.map((agent) => {
                const isLineActive = agent.active && Boolean(agent.has_permission);
                const isChecked = mode === "fallback" ? agent.active : isLineActive;
                const statusLabel = mode === "fallback"
                    ? (agent.active ? "Active" : "Paused")
                    : (isLineActive ? "Granted" : "Revoked");

                return (
                    <div
                        key={agent.id}
                        className="cb-grid-row cb-pool"
                        role="row"
                        style={POOL_GRID_STYLE}
                    >
                        <div className="cb-who">
                            <span className="cb-avatar" aria-hidden="true">
                                {getInitials(agent.name, agent.user_id)}
                            </span>
                            <span className="cb-who-text">
                                <span className="cb-name" title={agent.name ?? undefined}>
                                    {agent.name ?? `User #${agent.user_id}`}
                                </span>
                                {agent.email && <span className="cb-sub">{agent.email}</span>}
                                {agent.can_receive_calls === false && (
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            fontSize: "11px",
                                            color: "var(--dr-amber, #d97706)",
                                            marginTop: "2px",
                                        }}
                                    >
                                        <InfoCircleOutlined style={{ fontSize: "10px" }} />
                                        <span>Calls paused by user</span>
                                    </span>
                                )}
                            </span>
                        </div>

                        <PriorityCell
                            agentId={agent.id}
                            initialPriority={agent.priority}
                            otherPriorities={agents.filter((a) => a.id !== agent.id).map((a) => a.priority)}
                            onUpdated={onPriorityUpdated}
                        />

                        {/* Softphone Access (Line) or Route Calls to Me (Fallback) */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <Switch
                                checked={isChecked}
                                loading={Boolean(togglingUserIds[agent.user_id])}
                                onChange={() => onToggleAccess(agent)}
                                aria-label={mode === "fallback" ? `Toggle route calls to ${agent.name ?? "user"}` : `Toggle softphone access for ${agent.name ?? "agent"}`}
                            />
                            <span
                                style={{
                                    fontSize: "12px",
                                    color: isChecked ? "var(--dr-green, #10b981)" : "var(--dr-text-muted)",
                                    fontWeight: isChecked ? 600 : 400,
                                }}
                            >
                                {statusLabel}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="cb-icon-btn"
                            onClick={() => onRequestDelete(agent)}
                            aria-label={`Remove ${agent.name ?? "user"} from pool`}
                        >
                            <DeleteOutlined aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
        </>
    );
}
