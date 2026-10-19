import React, { useMemo, useState } from "react";
import { RightOutlined } from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import RecordingPlayer from "@/Components/CallRecordingPlayer";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";

import "@/Components/Redesign/redesign.css";
import "./CallBridgeSettings.css";

interface RecordingRow {
    id: number;
    filename: string;
    play_url: string;
    download_url: string | null;
    user_id: number;
    user_name: string | null;
    device_id: number | null;
    device_label: string | null;
    entity_type: string | null;
    entity_id: number | null;
    lead_name: string | null;
    phone_number: string | null;
    direction: string | null;
    routing_reason: string | null;
    duration_seconds: number;
    expires_at: string | null;
    is_expired: boolean;
}

interface Props {
    devices: SoftphoneDeviceSummary[];
}

const ROUTING_REASON_LABELS: Record<string, string> = {
    lead_owner: "Lead owner",
    pool_fallback: "Call pool fallback",
    unmatched: "No CRM match",
    outbound: "Outbound",
};

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";
    const total = Math.round(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return mins === 0 ? `${secs}s` : `${mins}m ${String(secs).padStart(2, "0")}s`;
}

/** "Inbound" chip + "Lead owner · Junior Prtu", or a muted "No context". */
function describeRecording(rec: RecordingRow): { chip: string | null; text: string } {
    const parts: string[] = [];
    let chip: string | null = null;
    if (rec.direction === "inbound") chip = "Inbound";
    else if (rec.direction === "outbound") chip = "Outbound";

    if (rec.routing_reason && ROUTING_REASON_LABELS[rec.routing_reason]) {
        parts.push(ROUTING_REASON_LABELS[rec.routing_reason]);
    }
    if (rec.lead_name) parts.push(rec.lead_name);
    else if (rec.phone_number) parts.push(rec.phone_number);

    if (!chip && parts.length === 0) {
        return {
            chip: null,
            text: rec.entity_type ? `${rec.entity_type} #${rec.entity_id ?? "—"}` : "No context",
        };
    }
    return { chip, text: parts.join(" · ") };
}

function lineOf(rec: RecordingRow, devices: SoftphoneDeviceSummary[]): string {
    if (rec.device_label) return rec.device_label;
    if (rec.device_id !== null) {
        const dev = devices.find((d) => d.id === rec.device_id);
        if (dev) return dev.label;
        return `Line #${rec.device_id}`;
    }
    return "Unassigned";
}

function isDefaultLine(label: string, devices: SoftphoneDeviceSummary[]): boolean {
    return !!devices.find((d) => d.label === label)?.is_default;
}

/**
 * Recordings for every agent on every line, grouped by the line they were made
 * on. The "All agents / Only me" filter is applied server-side across all
 * groups; groups without matches are hidden.
 */
export default function SoftphoneRecordingsPanel({ devices }: Props) {
    const { props } = usePage();
    const isAdmin = (props.auth?.user?.roles ?? []).some(
        (role: { name?: string }) => role?.name === "admin",
    );
    const [scope, setScope] = useState<"mine" | "company">(isAdmin ? "company" : "mine");

    const query = useApiQuery<{ status: string; data: RecordingRow[] }>({
        path: route("call-recordings.index"),
        params: { scope, limit: 200 },
    });

    const recordings = query.data?.data ?? [];

    const groups = useMemo(() => {
        const acc: Record<string, RecordingRow[]> = {};
        for (const rec of recordings) {
            const key = lineOf(rec, devices);
            (acc[key] ??= []).push(rec);
        }
        // Newest first inside each line.
        for (const rows of Object.values(acc)) {
            rows.sort((a, b) => b.id - a.id);
        }

        // Default line first, then the rest alphabetically — matches the call
        // pool ordering so the two tabs read consistently.
        const defaultFirst = (a: string, b: string) => {
            const aDefault = isDefaultLine(a, devices) ? 0 : 1;
            const bDefault = isDefaultLine(b, devices) ? 0 : 1;
            if (aDefault !== bDefault) return aDefault - bDefault;
            return a.localeCompare(b);
        };

        return Object.keys(acc)
            .sort(defaultFirst)
            .filter((key) => acc[key].length > 0)
            .map((key) => ({ key, rows: acc[key] }));
    }, [recordings, devices]);

    if (query.isLoading) {
        return <div className="cb-empty">Loading…</div>;
    }
    if (recordings.length === 0) {
        return (
            <EmptyState
                title="No recordings yet"
                description="Call recordings appear here once an agent records a call."
            />
        );
    }

    return (
        <>
            <div className="cb-toolbar">
                <span className="cb-toolbar__grow">
                    {isAdmin ? "Recordings for every agent on your lines." : "Your call recordings."}
                </span>
                {isAdmin && (
                    <div className="cb-seg" role="group" aria-label="Filter recordings">
                        <button
                            type="button"
                            aria-pressed={scope === "company"}
                            onClick={() => setScope("company")}
                        >
                            All agents
                        </button>
                        <button
                            type="button"
                            aria-pressed={scope === "mine"}
                            onClick={() => setScope("mine")}
                        >
                            Only me
                        </button>
                    </div>
                )}
            </div>

            {groups.map((group) => (
                <details key={group.key} className="cb-group" open>
                    <summary className="cb-summary">
                        <RightOutlined className="cb-chev" aria-hidden="true" />
                        <span className="cb-group__name">{group.key}</span>
                        {isDefaultLine(group.key, devices) && (
                            <span className="cb-chip cb-chip--default">Default</span>
                        )}
                        <span className="cb-group__count">
                            {group.rows.length} recording{group.rows.length === 1 ? "" : "s"}
                        </span>
                    </summary>

                    <div
                        className="cb-table cb-recs"
                        role="table"
                        aria-label={`${group.key} recordings`}
                    >
                        <div className="cb-grid-row cb-grid-row--head cb-recs" role="row">
                            <span>Recording</span>
                            <span>Agent</span>
                            <span>Duration</span>
                            <span>Playback</span>
                        </div>

                        {group.rows.map((rec) => {
                            const ctx = describeRecording(rec);
                            return (
                                <div
                                    key={rec.id}
                                    className="cb-grid-row cb-recs"
                                    role="row"
                                >
                                    <div className="cb-rec-cell">
                                        <div className="cb-file" title={rec.filename}>
                                            {rec.filename}
                                        </div>
                                        {rec.is_expired ? (
                                            <div className="cb-ctx cb-ctx--empty">
                                                Expired — no longer playable
                                            </div>
                                        ) : (
                                            <div className="cb-ctx" title={ctx.text}>
                                                {ctx.chip && (
                                                    <span className="cb-chip">{ctx.chip}</span>
                                                )}
                                                {ctx.text || "No context"}
                                            </div>
                                        )}
                                    </div>
                                    <span className="cb-col-agent" title={rec.user_name ?? undefined}>
                                        {rec.user_name ?? `User #${rec.user_id}`}
                                    </span>
                                    <span className="cb-col-dur cb-num">
                                        {formatDuration(rec.duration_seconds)}
                                    </span>
                                    <RecordingPlayer
                                        playUrl={rec.play_url}
                                        downloadUrl={rec.download_url}
                                        durationSeconds={rec.duration_seconds}
                                        filename={rec.filename}
                                        expired={rec.is_expired}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </details>
            ))}
        </>
    );
}