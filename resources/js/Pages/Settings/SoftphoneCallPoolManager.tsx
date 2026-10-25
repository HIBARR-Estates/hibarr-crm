import React, { useMemo, useState } from "react";
import axios from "axios";
import { DeleteOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { App, Select } from "antd";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";

import "@/Components/Redesign/redesign.css";
import "./CallBridgeSettings.css";

interface PoolAgent {
    id: number;
    user_id: number;
    name: string | null;
    email: string | null;
    priority: number;
    active: boolean;
}

interface EligibleUser {
    id: number;
    name: string;
    email: string | null;
}

interface PoolResponse {
    status: string;
    data: { agents: PoolAgent[] };
}

interface EligibleResponse {
    status: string;
    data: { users: EligibleUser[] };
}

function initials(name: string | null, userId: number): string {
    const source = name?.trim() || `User ${userId}`;
    return source
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

/**
 * One phone line's call pool: the agents who receive its inbound calls, plus
 * the inline "add agent" form that adds to this line.
 */
function LinePool({
    device,
}: {
    device: { id: number; label: string; is_default?: boolean };
}) {
    const { message } = App.useApp();
    const [picking, setPicking] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PoolAgent | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const poolQuery = useApiQuery<PoolResponse>({
        path: route("telephony.softphone.call-pool.index", { device_id: device.id }),
    });
    const eligibleQuery = useApiQuery<EligibleResponse>({
        path: route("telephony.softphone.call-pool.eligible"),
        options: { enabled: picking },
    });

    const agents = poolQuery.data?.data?.agents ?? [];
    const eligible = eligibleQuery.data?.data?.users ?? [];
    const alreadyInPool = new Set(agents.map((a) => a.user_id));
    const options = eligible
        .filter((u) => !alreadyInPool.has(u.id))
        .map((u) => ({
            value: u.id,
            label: u.email ? `${u.name} — ${u.email}` : u.name,
        }));

    const submitAdd = async () => {
        if (!selectedUserId) return;
        setSaving(true);
        try {
            await axios.post(
                route("telephony.softphone.call-pool.store"),
                { device_id: device.id, user_id: selectedUserId },
                { headers: { Accept: "application/json" } },
            );
            setPicking(false);
            setSelectedUserId(null);
            await poolQuery.refetch();
            void message.success("Agent added to the pool.");
        } catch {
            void message.error("Could not add agent.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!deleteTarget) return;
        setRemovingId(deleteTarget.id);
        try {
            await axios.delete(route("telephony.softphone.call-pool.destroy", deleteTarget.id), {
                headers: { Accept: "application/json" },
            });
            await poolQuery.refetch();
            setDeleteTarget(null);
            void message.success("Agent removed from the pool.");
        } catch {
            void message.error("Could not remove agent.");
        } finally {
            setRemovingId(null);
        }
    };

    const cancelAdd = () => {
        setPicking(false);
        setSelectedUserId(null);
    };

    return (
        <details className="cb-group" open>
            <summary className="cb-summary">
                <RightOutlined className="cb-chev" aria-hidden="true" />
                <span className="cb-group__name">{device.label}</span>
                {device.is_default && <span className="cb-chip cb-chip--default">Default</span>}
                <span className="cb-group__count">
                    {agents.length} agent{agents.length === 1 ? "" : "s"}
                </span>
            </summary>

            <div className="cb-table cb-pool" role="table" aria-label={`${device.label} agents`}>
                <div className="cb-grid-row cb-grid-row--head cb-pool" role="row">
                    <span>Agent</span>
                    <span>Priority</span>
                    <span aria-hidden="true" />
                </div>

                {poolQuery.isLoading ? (
                    <div className="cb-empty">Loading…</div>
                ) : agents.length === 0 ? (
                    <div className="cb-empty">No agents on this line yet.</div>
                ) : (
                    agents.map((agent) => (
                        <div
                            key={agent.id}
                            className="cb-grid-row cb-pool"
                            role="row"
                        >
                            <div className="cb-who">
                                <span className="cb-avatar" aria-hidden="true">
                                    {initials(agent.name, agent.user_id)}
                                </span>
                                <span className="cb-who-text">
                                    <span className="cb-name" title={agent.name ?? undefined}>
                                        {agent.name ?? `User #${agent.user_id}`}
                                    </span>
                                    {agent.email && <span className="cb-sub">{agent.email}</span>}
                                </span>
                            </div>
                            <span>
                                <span className="cb-prio cb-num">{agent.priority}</span>
                            </span>
                            <button
                                type="button"
                                className="cb-icon-btn"
                                aria-label={`Remove ${agent.name ?? "agent"} from ${device.label}`}
                                disabled={removingId === agent.id}
                                onClick={() => setDeleteTarget(agent)}
                            >
                                <DeleteOutlined aria-hidden="true" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="cb-group__foot">
                {!picking ? (
                    <button
                        type="button"
                        className="cb-btn cb-btn--ghost"
                        onClick={() => setPicking(true)}
                    >
                        <PlusOutlined aria-hidden="true" />
                        Add agent to {device.label}
                    </button>
                ) : (
                    <div className="cb-add-row">
                        <div className="cb-field">
                            <label htmlFor={`cb-add-${device.id}`}>Agent</label>
                            <Select
                                id={`cb-add-${device.id}`}
                                showSearch
                                value={selectedUserId ?? undefined}
                                onChange={setSelectedUserId}
                                style={{ width: "100%" }}
                                loading={eligibleQuery.isLoading}
                                optionFilterProp="label"
                                placeholder="Search agents with call permission"
                                options={options}
                                notFoundContent="Every eligible agent is already on this line."
                            />
                        </div>
                        <button
                            type="button"
                            className="cb-btn cb-btn--primary"
                            disabled={!selectedUserId || saving}
                            onClick={() => void submitAdd()}
                        >
                            Add
                        </button>
                        <button type="button" className="cb-btn" onClick={cancelAdd}>
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Remove agent from pool?"
                message={
                    deleteTarget
                        ? `${deleteTarget.name ?? "This agent"} will no longer receive inbound calls on ${device.label}.`
                        : ""
                }
                confirmLabel="Remove"
                cancelLabel="Cancel"
                danger
                confirmLoading={removingId !== null}
                onConfirm={() => void handleRemove()}
                onCancel={() => {
                    setDeleteTarget(null);
                    setRemovingId(null);
                }}
            />
        </details>
    );
}

/**
 * Call pool for every phone line. Each line is its own collapsible group with
 * its own agent table and its own "Add agent" button — default line first, then
 * the rest alphabetically.
 */
export default function SoftphoneCallPoolManager({
    devices,
}: {
    devices: SoftphoneDeviceSummary[];
}) {
    const sorted = useMemo(() => {
        return [...devices].sort((a, b) => {
            if (a.is_default !== b.is_default) {
                return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
            }
            return a.label.localeCompare(b.label);
        });
    }, [devices]);

    if (sorted.length === 0) {
        return (
            <EmptyState title="No phone lines" description="Add a line under the Lines tab first." />
        );
    }

    return (
        <>
            <div className="cb-toolbar">
                <span className="cb-toolbar__grow">
                    Agents who receive calls, grouped by line.
                </span>
            </div>
            {sorted.map((device) => (
                <LinePool key={device.id} device={device} />
            ))}
        </>
    );
}