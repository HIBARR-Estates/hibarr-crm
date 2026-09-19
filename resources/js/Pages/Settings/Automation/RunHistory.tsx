import { useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { LogStatus, RunHistoryEntry, RunLogEntry } from "./types";
import { channelIcon, statusToVariant } from "./shared";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useAutomationLogs from "./hooks/useAutomationLogs";
import RunLogDetailPanel from "./components/RunLogDetailPanel";

type StatusFilter = "all" | LogStatus;

const ROW_COLS = {
    gridTemplateColumns: "150px minmax(140px,1.2fr) minmax(120px,1fr) 130px 100px minmax(160px,1.4fr) 24px",
};

/** Distinct channels in a run, in the order its steps ran. */
function runChannels(run: RunHistoryEntry): string[] {
    return Array.from(new Set(run.steps.map((s) => s.channel).filter(Boolean) as string[]));
}

function RowSkeleton() {
    return (
        <div
            className="grid gap-3.5 items-center min-w-[900px] px-4.5 py-3 border-b last:border-b-0 animate-pulse"
            style={{ ...ROW_COLS, borderColor: "#f4f5f7" }}
        >
            {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-3.5 rounded" style={{ background: "#eef1f5", width: i === 0 ? "70%" : "85%" }} />
            ))}
        </div>
    );
}

/**
 * One action inside a run. Expands to its diagnostics only when the step
 * actually recorded any — most steps (a stage move, a field set) have nothing
 * beyond their description, and an "expand" affordance that reveals nothing
 * is worse than none.
 */
function StepRow({ step, index, t }: { step: RunLogEntry; index: number; t: (k: string) => string }) {
    const [open, setOpen] = useState(false);
    const expandable = step.has_details === true || step.details != null;

    return (
        <div className="rounded-lg" style={{ border: `1px solid ${T.BORDER_SOFT}`, background: "#fff" }}>
            <div
                role={expandable ? "button" : undefined}
                tabIndex={expandable ? 0 : undefined}
                aria-expanded={expandable ? open : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 ${expandable ? "cursor-pointer" : ""}`}
                onClick={expandable ? () => setOpen((v) => !v) : undefined}
                onKeyDown={
                    expandable
                        ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setOpen((v) => !v);
                              }
                          }
                        : undefined
                }
            >
                <span
                    className="rounded-md flex items-center justify-center shrink-0"
                    style={{ width: 24, height: 24, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}`, fontSize: 11, fontWeight: 700, color: T.TEXT_HINT }}
                >
                    {index + 1}
                </span>

                <Icon name={channelIcon(step.channel)} size={14} color={T.TEXT_HINT} />

                <span className="flex-1 min-w-0" style={{ fontSize: 12, color: T.TEXT }}>
                    {step.action}
                </span>

                <span className="shrink-0" style={{ fontSize: 11, color: T.TEXT_HINT }}>
                    {new Date(step.executed_at).toLocaleTimeString()}
                </span>

                <Badge variant={statusToVariant(step.status)}>{t(`app.automation.results.${step.status}`)}</Badge>

                {expandable && <Icon name={open ? "chevron-up" : "chevron-down"} size={13} color={T.TEXT_HINT} />}
            </div>

            {expandable && open && <RunLogDetailPanel entry={step} />}
        </div>
    );
}

export default function RunHistory() {
    const { t } = useTranslation();
    const { automations } = useAutomationWorkspace();
    const [status, setStatus] = useState<StatusFilter>("all");
    const [automationId, setAutomationId] = useState<number | undefined>(undefined);
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

    const { runs, meta, loading } = useAutomationLogs({
        status: status === "all" ? undefined : status,
        automationId,
        page,
        refreshKey,
    });

    const filters: StatusFilter[] = ["all", "success", "skipped", "failed"];
    const filterLabels: Record<StatusFilter, string> = {
        all: t("app.automation.filters.all"),
        success: t("app.automation.results.success"),
        skipped: t("app.automation.results.skipped"),
        failed: t("app.automation.results.failed"),
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {t("app.automation.runHistory")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.runHistorySubtitle")}
                    </p>
                </div>
                <Button variant="ghost" icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)} loading={loading}>
                    {t("app.automation.refresh")}
                </Button>
            </div>

            <div className="flex gap-2 mb-3.5 flex-wrap items-center">
                {filters.map((f) => (
                    <button
                        key={f}
                        type="button"
                        className="dr-filter"
                        aria-pressed={status === f}
                        onClick={() => {
                            setStatus(f);
                            setPage(1);
                        }}
                    >
                        {filterLabels[f]}
                    </button>
                ))}
                <SearchableSelect
                    value={automationId}
                    onChange={(value) => {
                        setAutomationId(value ?? undefined);
                        setPage(1);
                    }}
                    options={automations.map((a) => ({ value: a.id, label: a.name }))}
                    allowClear
                    placeholder={t("app.automation.automations")}
                    className="ml-auto"
                    style={{ width: 220 }}
                />
            </div>

            <div className="rounded-[10px] border bg-white overflow-x-auto" style={{ borderColor: T.BORDER }}>
                <div
                    className="grid gap-3.5 items-center min-w-[900px] px-4.5 py-2.5 border-b"
                    style={{
                        ...ROW_COLS,
                        background: T.SURFACE_2,
                        borderColor: T.BORDER,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: T.GRAY_DARKER,
                    }}
                >
                    <span>{t("app.automation.columns.time")}</span>
                    <span>{t("app.automation.automation")}</span>
                    <span>{t("app.automation.columns.record")}</span>
                    <span>{t("app.automation.columns.steps")}</span>
                    <span>{t("app.automation.columns.result")}</span>
                    <span>{t("app.automation.columns.detail")}</span>
                    <span aria-hidden="true" />
                </div>

                {loading && Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}

                {!loading && runs.length === 0 && (
                    <div className="px-4.5 py-8">
                        <EmptyState
                            title={t("app.automation.noActivityYet")}
                            description={t("app.automation.noActivityYetDescription")}
                        />
                    </div>
                )}

                {!loading && runs.map((run) => {
                    const expanded = expandedRunId === run.run_id;
                    const channels = runChannels(run);

                    return (
                        <div key={run.run_id} className="border-b last:border-b-0" style={{ borderColor: "#f4f5f7" }}>
                            <div
                                role="button"
                                tabIndex={0}
                                aria-expanded={expanded}
                                className="grid gap-3.5 items-center min-w-[900px] px-4.5 py-3 cursor-pointer"
                                style={ROW_COLS}
                                onClick={() => setExpandedRunId(expanded ? null : run.run_id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setExpandedRunId(expanded ? null : run.run_id);
                                    }
                                }}
                            >
                                <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                    {new Date(run.executed_at).toLocaleString()}
                                </span>
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                                    {run.automation?.name ?? "—"}
                                </span>
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                                    {run.deal?.name ?? run.lead?.client_name ?? "—"}
                                </span>

                                {/* The action count for this one execution, with a
                                    glance at which kinds of action it performed. */}
                                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                    {channels.slice(0, 3).map((channel) => (
                                        <Icon key={channel} name={channelIcon(channel as RunLogEntry["channel"])} size={13} color={T.TEXT_HINT} />
                                    ))}
                                    {run.steps_count === 1
                                        ? t("app.automation.oneStep")
                                        : t("app.automation.stepCount", { count: run.steps_count })}
                                </span>

                                <span>
                                    <Badge variant={statusToVariant(run.status)}>{t(`app.automation.results.${run.status}`)}</Badge>
                                </span>
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                    {run.steps[0]?.action ?? "—"}
                                </span>
                                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} color={T.TEXT_HINT} />
                            </div>

                            {expanded && (
                                <div
                                    className="min-w-[900px] px-4.5 py-3.5 flex flex-col gap-2"
                                    style={{ background: T.SURFACE_2, borderTop: `1px solid ${T.BORDER}` }}
                                >
                                    {run.steps.map((step, i) => (
                                        <StepRow key={step.id} step={step} index={i} t={t} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {meta && meta.lastPage > 1 && (
                <div className="flex items-center justify-center gap-3 mt-3.5">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        {t("app.previous")}
                    </Button>
                    <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                        {meta.currentPage} / {meta.lastPage}
                    </span>
                    <Button variant="ghost" size="sm" disabled={page >= meta.lastPage} onClick={() => setPage((p) => p + 1)}>
                        {t("app.next")}
                    </Button>
                </div>
            )}
        </div>
    );
}
