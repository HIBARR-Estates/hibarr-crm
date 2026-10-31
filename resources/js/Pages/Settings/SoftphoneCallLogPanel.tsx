import React, { useRef, useState } from "react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiQuery } from "@/lib/api/client/useApiQuery";

import "@/Components/Redesign/redesign.css";
import "./CallBridgeSettings.css";

type Outcome =
    | "started"
    | "ended"
    | "missed"
    | "declined"
    | "voicemail"
    | "busy"
    | "failed";

interface CallLogRow {
    id: number;
    occurred_at: string | null;
    outcome: Outcome;
    direction: "inbound" | "outbound" | null;
    phone_number: string | null;
    duration: number | null;
    user_id: number | null;
    user_name: string | null;
    entity_type: "lead" | "deal" | null;
    entity_id: number | null;
    entity_name: string | null;
    entity_url: string | null;
    failure_reason: string | null;
    failure_message: string | null;
    has_recording: boolean;
}

interface CallLogResponse {
    status: string;
    data: CallLogRow[];
    meta: { page: number; per_page: number; total: number; last_page: number };
}

const OUTCOMES: { value: "" | Outcome; label: string }[] = [
    { value: "", label: "All outcomes" },
    { value: "ended", label: "Completed" },
    { value: "failed", label: "Failed to connect" },
    { value: "missed", label: "No answer" },
    { value: "declined", label: "Declined" },
    { value: "busy", label: "Busy" },
    { value: "voicemail", label: "Voicemail" },
    { value: "started", label: "Started" },
];

const OUTCOME_LABEL: Record<Outcome, string> = {
    started: "Started",
    ended: "Completed",
    missed: "No answer",
    declined: "Declined",
    voicemail: "Voicemail",
    busy: "Busy",
    failed: "Failed to connect",
};

const FAILURE_REASON_LABEL: Record<string, string> = {
    suppressed: "On suppression list",
    rejected: "Rejected by bridge",
    not_configured: "Bridge not configured",
    bridge_unreachable: "Bridge unreachable",
    bridge_error: "Bridge error",
};

function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins === 0 ? `${secs}s` : `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function formatWhen(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
          });
}

/**
 * Every call made or received through the CRM, newest first — including
 * attempts that never connected. Admin-only (the endpoint enforces it too).
 */
export default function SoftphoneCallLogPanel() {
    const { td } = useTd();
    const [page, setPage] = useState(1);
    const [outcome, setOutcome] = useState<"" | Outcome>("");
    const [direction, setDirection] = useState<"" | "inbound" | "outbound">("");
    const [search, setSearch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const query = useApiQuery<CallLogResponse>({
        path: route("telephony.calls.log"),
        params: {
            page,
            per_page: 25,
            ...(outcome ? { outcome } : {}),
            ...(direction ? { direction } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        },
    });

    // Keep the last page on screen while a new filter/page loads so the table
    // does not flash empty between requests.
    const lastData = useRef<CallLogResponse | undefined>(undefined);
    if (query.data) lastData.current = query.data;
    const data = query.data ?? lastData.current;

    const rows = data?.data ?? [];
    const meta = data?.meta;

    const filtered = outcome !== "" || direction !== "" || search.trim() !== "" || from !== "" || to !== "";

    const resetTo = <T,>(set: (value: T) => void) => (value: T) => {
        set(value);
        setPage(1);
    };

    const clearFilters = () => {
        setOutcome("");
        setDirection("");
        setSearch("");
        setFrom("");
        setTo("");
        setPage(1);
    };

    return (
        <>
            <div className="cb-toolbar">
                <span className="cb-toolbar__grow">
                    {td("Every call made or received through the CRM, including attempts that did not connect.", {
                        source: "en",
                    })}
                    {meta ? ` (${meta.total})` : ""}
                </span>
                <input
                    type="search"
                    className="cb-input"
                    placeholder={td("Search phone number", { source: "en" })}
                    aria-label={td("Search phone number", { source: "en" })}
                    value={search}
                    onChange={(e) => resetTo(setSearch)(e.target.value)}
                />
                <select
                    className="cb-input"
                    aria-label={td("Filter by outcome", { source: "en" })}
                    value={outcome}
                    onChange={(e) => resetTo(setOutcome)(e.target.value as "" | Outcome)}
                >
                    {OUTCOMES.map((item) => (
                        <option key={item.value} value={item.value}>
                            {td(item.label, { source: "en" })}
                        </option>
                    ))}
                </select>
                <select
                    className="cb-input"
                    aria-label={td("Filter by direction", { source: "en" })}
                    value={direction}
                    onChange={(e) =>
                        resetTo(setDirection)(e.target.value as "" | "inbound" | "outbound")
                    }
                >
                    <option value="">{td("All directions", { source: "en" })}</option>
                    <option value="outbound">{td("Outbound", { source: "en" })}</option>
                    <option value="inbound">{td("Inbound", { source: "en" })}</option>
                </select>
                <input
                    type="date"
                    className="cb-input"
                    aria-label={td("From date", { source: "en" })}
                    value={from}
                    onChange={(e) => resetTo(setFrom)(e.target.value)}
                />
                <input
                    type="date"
                    className="cb-input"
                    aria-label={td("To date", { source: "en" })}
                    value={to}
                    onChange={(e) => resetTo(setTo)(e.target.value)}
                />
            </div>

            {query.isLoading && !data ? (
                <div className="cb-empty">{td("Loading…", { source: "en" })}</div>
            ) : query.isError && !data ? (
                <div className="cb-empty">
                    {td("Could not load the call log.", { source: "en" })}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState
                    title={td(filtered ? "No calls match these filters" : "No calls yet", { source: "en" })}
                    description={td(
                        filtered
                            ? "Try a different outcome, date range or number."
                            : "Calls made from leads and deals appear here.",
                        { source: "en" },
                    )}
                    action={
                        filtered
                            ? {
                                  label: td("Clear filters", { source: "en" }),
                                  onClick: clearFilters,
                                  icon: null,
                              }
                            : undefined
                    }
                />
            ) : (
                <div className="cb-table cb-calls" role="table" aria-label={td("Call log", { source: "en" })}>
                    <div className="cb-grid-row cb-grid-row--head cb-calls" role="row">
                        <span>{td("When", { source: "en" })}</span>
                        <span>{td("Lead / deal", { source: "en" })}</span>
                        <span>{td("Number", { source: "en" })}</span>
                        <span>{td("Agent", { source: "en" })}</span>
                        <span>{td("Outcome", { source: "en" })}</span>
                        <span>{td("Duration", { source: "en" })}</span>
                    </div>
                    {rows.map((row) => {
                        const reason =
                            row.failure_message ??
                            (row.failure_reason
                                ? (FAILURE_REASON_LABEL[row.failure_reason] ?? row.failure_reason)
                                : null);
                        return (
                            <div key={row.id} className="cb-grid-row cb-calls" role="row">
                                <span className="cb-num">{formatWhen(row.occurred_at)}</span>
                                <span className="cb-col-entity">
                                    {row.entity_url ? (
                                        <a href={row.entity_url}>
                                            {row.entity_name ?? `${row.entity_type} #${row.entity_id}`}
                                        </a>
                                    ) : (
                                        <span className="cb-ctx--empty">—</span>
                                    )}
                                </span>
                                <span className="cb-num cb-col-number">
                                    {row.direction && (
                                        <span className="cb-chip">
                                            {row.direction === "inbound"
                                                ? td("In", { source: "en" })
                                                : td("Out", { source: "en" })}
                                        </span>
                                    )}{" "}
                                    {row.phone_number ?? "—"}
                                </span>
                                <span className="cb-col-agent" title={row.user_name ?? undefined}>
                                    {row.user_name ?? "—"}
                                </span>
                                <span className="cb-col-outcome">
                                    <span
                                        className={`cb-outcome cb-outcome--${row.outcome}`}
                                        title={reason ?? undefined}
                                    >
                                        {td(OUTCOME_LABEL[row.outcome] ?? row.outcome, { source: "en" })}
                                    </span>
                                    {reason && row.outcome === "failed" && (
                                        <div className="cb-ctx cb-ctx--empty">{reason}</div>
                                    )}
                                </span>
                                <span className="cb-col-dur cb-num">{formatDuration(row.duration)}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {meta && meta.last_page > 1 && (
                <div className="cb-toolbar" style={{ marginTop: 16 }}>
                    <span className="cb-toolbar__grow">
                        {td("Page", { source: "en" })} {meta.page} / {meta.last_page}
                    </span>
                    <button
                        type="button"
                        className="cb-btn"
                        disabled={meta.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        {td("Previous", { source: "en" })}
                    </button>
                    <button
                        type="button"
                        className="cb-btn"
                        disabled={meta.page >= meta.last_page}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        {td("Next", { source: "en" })}
                    </button>
                </div>
            )}
        </>
    );
}
