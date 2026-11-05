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
    data: { agents: PoolAgent[]; fallback_seconds?: number };
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
            void message.success("Agent added to the line pool.");
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
            void message.success("Agent removed from line pool.");
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
                {device.is_default && <span className="cb-chip cb-chip--default">Default Line</span>}
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
                    <div className="cb-empty">No agents assigned to this line yet.</div>
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
                                placeholder="Search agents who can make calls"
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
                title="Remove agent from line pool?"
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
 * Admin Fallback List: The users/admins who receive the call when the lead owner
 * and line pool agents are unavailable or pass.
 */
function AdminFallbackPool() {
    const { message } = App.useApp();
    const [picking, setPicking] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PoolAgent | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const poolQuery = useApiQuery<PoolResponse>({
        path: route("telephony.softphone.call-pool.index", { scope: "fallback" }),
    });
    const eligibleQuery = useApiQuery<EligibleResponse>({
        path: route("telephony.softphone.call-pool.eligible", { scope: "fallback" }),
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
                { scope: "fallback", user_id: selectedUserId },
                { headers: { Accept: "application/json" } },
            );
            setPicking(false);
            setSelectedUserId(null);
            await poolQuery.refetch();
            void message.success("User added to admin fallback list.");
        } catch {
            void message.error("Could not add user.");
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
            void message.success("User removed from admin fallback list.");
        } catch {
            void message.error("Could not remove user.");
        } finally {
            setRemovingId(null);
        }
    };

    const cancelAdd = () => {
        setPicking(false);
        setSelectedUserId(null);
    };

    return (
        <details className="cb-group" open style={{ marginTop: "24px" }}>
            <summary className="cb-summary">
                <RightOutlined className="cb-chev" aria-hidden="true" />
                <span className="cb-group__name">Admin Fallback List</span>
                <span
                    className="cb-chip"
                    style={{
                        background: "var(--rd-brand-50, #eff8ff)",
                        color: "var(--rd-brand-700, #175cd3)",
                        border: "1px solid var(--rd-brand-200, #b2ddff)",
                    }}
                >
                    Fallback Tier
                </span>
                <span className="cb-group__count">
                    {agents.length > 0
                        ? `${agents.length} user${agents.length === 1 ? "" : "s"}`
                        : "Default (all active admins)"}
                </span>
            </summary>

            <div
                style={{
                    padding: "8px 20px 12px",
                    fontSize: "13px",
                    color: "var(--dr-text-muted)",
                    background: "var(--dr-surface)",
                }}
            >
                Users on this list receive the call if the lead owner and line agents are unavailable or pass.
            </div>

            <div className="cb-table cb-pool" role="table" aria-label="Admin fallback users">
                <div className="cb-grid-row cb-grid-row--head cb-pool" role="row">
                    <span>Fallback User</span>
                    <span>Priority</span>
                    <span aria-hidden="true" />
                </div>

                {poolQuery.isLoading ? (
                    <div className="cb-empty">Loading…</div>
                ) : agents.length === 0 ? (
                    <div className="cb-empty">
                        No specific users assigned. All active administrators will receive the call as the default fallback.
                    </div>
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
                                aria-label={`Remove ${agent.name ?? "user"} from fallback list`}
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
                        Add user to fallback list
                    </button>
                ) : (
                    <div className="cb-add-row">
                        <div className="cb-field">
                            <label htmlFor="cb-add-fallback-user">User</label>
                            <Select
                                id="cb-add-fallback-user"
                                showSearch
                                value={selectedUserId ?? undefined}
                                onChange={setSelectedUserId}
                                style={{ width: "100%" }}
                                loading={eligibleQuery.isLoading}
                                optionFilterProp="label"
                                placeholder="Search active users and admins"
                                options={options}
                                notFoundContent="All eligible users are already on the fallback list."
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
                title="Remove user from fallback list?"
                message={
                    deleteTarget
                        ? `${deleteTarget.name ?? "This user"} will no longer receive fallback calls.`
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
 * Call Routing Manager:
 * 1. Rotation Timing: Configure time between calls (seconds).
 * 2. Line Routing: Who gets the call based on the line (ordered agents per line).
 * 3. Admin Fallback List: Who is on the fallback tier list.
 */
export default function SoftphoneCallPoolManager({
    devices,
    initialFallbackSeconds = 20,
}: {
    devices: SoftphoneDeviceSummary[];
    initialFallbackSeconds?: number;
}) {
    const { message } = App.useApp();
    const [savedSeconds, setSavedSeconds] = useState<number>(initialFallbackSeconds);
    const [secondsInput, setSecondsInput] = useState<string>(String(initialFallbackSeconds));
    const [secondsError, setSecondsError] = useState<string | null>(null);
    const [savingSettings, setSavingSettings] = useState<boolean>(false);

    const parsedSeconds = Number.parseInt(secondsInput, 10);
    const isValidSeconds = Number.isFinite(parsedSeconds) && parsedSeconds >= 1 && parsedSeconds <= 600;
    const isDirtySeconds = isValidSeconds && parsedSeconds !== savedSeconds;

    const saveFallbackSeconds = async () => {
        setSecondsError(null);
        if (!isValidSeconds) {
            const msg = "Enter a valid time between calls (1–600 seconds).";
            setSecondsError(msg);
            void message.error(msg);
            return;
        }
        setSavingSettings(true);
        try {
            const res = await axios.post<{ status?: string; data?: { fallback_seconds?: number } }>(
                route("telephony.softphone.call-pool.store"),
                { incoming_call_fallback_seconds: parsedSeconds },
                { headers: { Accept: "application/json" } },
            );
            const nextVal = res.data?.data?.fallback_seconds ?? parsedSeconds;
            setSavedSeconds(nextVal);
            setSecondsInput(String(nextVal));
            void message.success("Time between calls updated.");
        } catch (err: unknown) {
            const serverMsg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Could not update time between calls.";
            setSecondsError(serverMsg);
            void message.error(serverMsg);
        } finally {
            setSavingSettings(false);
        }
    };

    const sorted = useMemo(() => {
        return [...devices].sort((a, b) => {
            if (a.is_default !== b.is_default) {
                return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
            }
            return a.label.localeCompare(b.label);
        });
    }, [devices]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Section 1: Call Rotation Timing */}
            <div
                style={{
                    padding: "16px 20px",
                    background: "var(--dr-surface)",
                    border: "1px solid var(--dr-border)",
                    borderRadius: "var(--cb-radius)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "16px",
                }}
            >
                <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--dr-text)" }}>
                        Call Rotation Timing
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--dr-text-muted)" }}>
                        How many seconds an incoming call rings each user before advancing to the next in rotation.
                    </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                        <label
                            htmlFor="cb-fallback-seconds"
                            style={{ fontSize: "13px", fontWeight: 500, color: "var(--dr-text)" }}
                        >
                            Time between calls:
                        </label>
                        <input
                            id="cb-fallback-seconds"
                            type="number"
                            min={1}
                            max={600}
                            className="cb-input cb-num"
                            style={{ width: "80px" }}
                            value={secondsInput}
                            onChange={(e) => {
                                setSecondsInput(e.target.value);
                                setSecondsError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && isDirtySeconds && !savingSettings) {
                                    e.preventDefault();
                                    void saveFallbackSeconds();
                                }
                            }}
                        />
                        <span style={{ fontSize: "13px", color: "var(--dr-text-muted)" }}>seconds</span>
                        <button
                            type="button"
                            className="cb-btn cb-btn--primary"
                            disabled={!isDirtySeconds || savingSettings}
                            onClick={() => void saveFallbackSeconds()}
                        >
                            {savingSettings ? "Saving…" : "Save"}
                        </button>
                    </div>
                    {(secondsError || (secondsInput !== "" && !isValidSeconds)) && (
                        <span role="alert" style={{ fontSize: "12px", color: "var(--dr-red, #dc2626)" }}>
                            {secondsError || "Enter a valid time between calls (1–600 seconds)."}
                        </span>
                    )}
                </div>
            </div>

            {/* Section 2: Line Routing (Who gets the call based on line) */}
            <div>
                <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--dr-text)" }}>
                        Line Routing
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--dr-text-muted)" }}>
                        Configure who gets incoming calls for each phone line, in order of priority.
                    </p>
                </div>

                {sorted.length === 0 ? (
                    <EmptyState title="No phone lines" description="Add a line under the Lines tab first." />
                ) : (
                    sorted.map((device) => (
                        <LinePool key={device.id} device={device} />
                    ))
                )}
            </div>

            {/* Section 3: Admin Fallback List */}
            <AdminFallbackPool />
        </div>
    );
}
