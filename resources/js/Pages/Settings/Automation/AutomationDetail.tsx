import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Automation, AutomationFiredForRow } from "./types";
import { actionTypeIcon, actionTypeLabel, statusToVariant, triggerIcon, triggerLabel } from "./shared";
import {
    describeAction,
    describeAutomationWait,
    describeCondition,
    describeConditionGate,
} from "./adapters/automationSummary";
import useAutomationStats from "./hooks/useAutomationStats";
import useAutomationLogs from "./hooks/useAutomationLogs";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";

interface AutomationDetailProps {
    automation: Automation;
    onBack: () => void;
    onEditFlow: () => void;
}

const BAR_MAX_FLOOR = 1;

/** Small uppercase kicker above each step's own name in the Flow card. */
const STEP_KICKER = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: T.TEXT_HINT,
};

/** One clause of "what this step actually does". */
const STEP_LINE = { fontSize: 12, color: T.TEXT_MUTED, marginTop: 2 };

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 px-4.5 py-3 border-b last:border-b-0 animate-pulse" style={{ borderColor: "#f4f5f7" }}>
            <div className="h-3.5 w-24 rounded shrink-0" style={{ background: "#eef1f5" }} />
            <div className="h-3.5 flex-1 rounded" style={{ background: "#eef1f5" }} />
        </div>
    );
}

export default function AutomationDetail({ automation, onBack, onEditFlow }: AutomationDetailProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { catalog } = useAutomationWorkspace();
    const { stats, loading: statsLoading } = useAutomationStats(automation.id);
    const { logs, loading: logsLoading } = useAutomationLogs({ automationId: automation.id });

    const chart = stats?.runs_last_7_days ?? [];
    const barMax = Math.max(...chart.map((b) => b.value), BAR_MAX_FLOOR);

    const waitLabel = automation.wait_duration_value
        ? `${automation.wait_duration_value} ${catalog?.waitDurationUnits[automation.wait_duration_unit ?? "days"] ?? automation.wait_duration_unit}`
        : t("app.automation.immediate");

    const stats4 = [
        { label: t("app.automation.stats.totalRuns"), value: (stats?.total_runs ?? 0).toLocaleString("en-US"), sub: t("app.automation.stats.allTime") },
        { label: t("app.automation.stats.successRate"), value: stats?.success_rate != null ? `${stats.success_rate}%` : "—", sub: t("app.automation.stats.allTime") },
        { label: t("app.automation.stats.configuredWait"), value: waitLabel, sub: "" },
        // Priority already has its own row in the Details card below, so this
        // slot says something the run count alone can't: how many separate
        // records those runs were spread across.
        {
            label: t("app.automation.stats.recordsFiredFor"),
            value: (stats?.fired_for_total ?? 0).toLocaleString("en-US"),
            sub: t("app.automation.stats.allTime"),
        },
    ];

    const firedFor = stats?.fired_for ?? [];
    const firedForTotal = stats?.fired_for_total ?? 0;

    const recordUrl = (row: AutomationFiredForRow): string | null => {
        if (row.subject_type === "deal" && row.deal_id) return route("deals.show", row.deal_id);
        if (row.lead_id) return route("lead-contact.show", row.lead_id);

        return null;
    };

    return (
        <div>
            <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 border-0 bg-transparent cursor-pointer p-0 mb-3"
                style={{ fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}
            >
                <Icon name="chevron-left" size={15} />
                {t("app.automation.backToAutomations")}
            </button>

            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                            {automation.name}
                        </h1>
                        <Badge variant={automation.active ? "green" : "gray"}>
                            {automation.active ? t("app.automation.active") : t("app.automation.paused")}
                        </Badge>
                    </div>
                    <p className="mt-1.5 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {automation.subject_type === "lead" ? t("app.automation.leadAutomation") : t("app.automation.dealAutomation")}
                        {" · "}
                        {td(triggerLabel(automation.trigger))}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="primary" icon={<Icon name="edit" size={14} color={T.WHITE} />} onClick={onEditFlow}>
                        {t("app.automation.editFlow")}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3.5 mb-4">
                {stats4.map((st, i) => (
                    <div key={st.label} className="rounded-[10px] border bg-white p-4" style={{ borderColor: T.BORDER }}>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_MUTED }}>
                            {st.label}
                        </div>
                        {statsLoading && i < 2 ? (
                            <div className="animate-pulse h-6 w-14 rounded mt-2 mb-1" style={{ background: "#eef1f5" }} />
                        ) : (
                            <div className="leading-none" style={{ fontSize: 22, fontWeight: 700, color: T.NAVY, margin: "8px 0 3px" }}>
                                {st.value}
                            </div>
                        )}
                        {st.sub && <div style={{ fontSize: 12, fontWeight: 500, color: T.TEXT_MUTED }}>{st.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Flow now spells out each condition and action, so it needs more
                room than the old icon-and-label list did. */}
            <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
                <div className="flex flex-col gap-4">
                    <div className="rounded-[10px] border bg-white p-4.5" style={{ borderColor: T.BORDER }}>
                        <div className="mb-4" style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                            {t("app.automation.runsLast7Days")}
                        </div>
                        {statsLoading ? (
                            <div className="flex items-end gap-3.5" style={{ height: 150 }}>
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-t animate-pulse"
                                        style={{ background: "#eef1f5", height: `${30 + (i % 4) * 15}%` }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-end gap-3.5" style={{ height: 150 }}>
                                {chart.map((b) => (
                                    <div key={b.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                        <div style={{ fontSize: 11, fontWeight: 600, color: T.TEXT_MUTED }}>{b.value}</div>
                                        <div
                                            className="w-full"
                                            style={{
                                                background: T.BLUE,
                                                borderRadius: "6px 6px 0 0",
                                                height: `${Math.round((b.value / barMax) * 100)}%`,
                                            }}
                                        />
                                        <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                                            {new Date(b.day).toLocaleDateString(undefined, { weekday: "short" })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Who it actually fired for — the run count broken out per
                        record, so "412 runs" isn't mistaken for 412 people. */}
                    <div className="rounded-[10px] border bg-white overflow-hidden" style={{ borderColor: T.BORDER }}>
                        <div
                            className="px-4.5 py-3.5 border-b flex items-center justify-between gap-3"
                            style={{ borderColor: T.BORDER_SOFT }}
                        >
                            <span style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                                {t("app.automation.firedFor")}
                            </span>
                            {firedForTotal > firedFor.length && (
                                <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                    {`${firedFor.length} / ${firedForTotal.toLocaleString("en-US")}`}
                                </span>
                            )}
                        </div>

                        {statsLoading && Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}

                        {!statsLoading && firedFor.length === 0 && (
                            <div className="px-4.5 py-6">
                                <EmptyState
                                    title={t("app.automation.noActivityYet")}
                                    description={t("app.automation.noActivityYetDescription")}
                                />
                            </div>
                        )}

                        {!statsLoading && firedFor.map((row) => {
                            const href = recordUrl(row);
                            const name = row.person_name || row.record_name || t("app.automation.deletedRecord");
                            // The deal's own name only earns a line when it differs
                            // from the person's — often a deal is named after them.
                            const secondary = [
                                row.record_name && row.record_name !== name ? row.record_name : null,
                                row.person_email,
                            ]
                                .filter(Boolean)
                                .join(" · ");

                            return (
                                <div
                                    key={`${row.subject_type}-${row.deal_id ?? "x"}-${row.lead_id ?? "x"}`}
                                    className="flex items-center gap-3 px-4.5 py-3 border-b last:border-b-0"
                                    style={{ borderColor: "#f4f5f7" }}
                                >
                                    <div className="flex-1 min-w-0">
                                        {href ? (
                                            <a
                                                href={href}
                                                className="whitespace-nowrap overflow-hidden text-ellipsis block"
                                                style={{ fontSize: 13, fontWeight: 600, color: T.BLUE_DARK }}
                                            >
                                                {name}
                                            </a>
                                        ) : (
                                            <div className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                                                {name}
                                            </div>
                                        )}
                                        {secondary && (
                                            <div className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                                {secondary}
                                            </div>
                                        )}
                                    </div>

                                    <span className="shrink-0 text-right" style={{ fontSize: 12, color: T.TEXT_HINT, width: 120 }}>
                                        {row.last_run_at ? new Date(row.last_run_at).toLocaleString() : "—"}
                                    </span>

                                    <span className="shrink-0 flex items-center gap-1.5">
                                        <Badge variant="gray">
                                            {row.runs === 1
                                                ? t("app.automation.oneRun")
                                                : t("app.automation.runCount", { count: row.runs })}
                                        </Badge>
                                        {row.failed_runs > 0 && <Badge variant="red">{row.failed_runs}</Badge>}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="rounded-[10px] border bg-white overflow-hidden" style={{ borderColor: T.BORDER }}>
                        <div className="px-4.5 py-3.5 border-b" style={{ borderColor: T.BORDER_SOFT, fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                            {t("app.automation.recentRuns")}
                        </div>
                        {logsLoading && Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
                        {!logsLoading && logs.length === 0 && (
                            <div className="px-4.5 py-6">
                                <EmptyState
                                    title={t("app.automation.noActivityYet")}
                                    description={t("app.automation.noActivityYetDescription")}
                                />
                            </div>
                        )}
                        {!logsLoading && logs.slice(0, 5).map((entry) => (
                            <div key={entry.id} className="flex items-center gap-3 px-4.5 py-3 border-b last:border-b-0" style={{ borderColor: "#f4f5f7" }}>
                                <span className="shrink-0" style={{ fontSize: 12, color: T.TEXT_HINT, width: 130 }}>
                                    {new Date(entry.executed_at).toLocaleString()}
                                </span>
                                <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13, color: T.TEXT }}>
                                    {entry.deal?.name ?? entry.lead?.client_name ?? "—"} — {entry.action}
                                </span>
                                <Badge variant={statusToVariant(entry.status)}>{t(`app.automation.results.${entry.status}`)}</Badge>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="rounded-[10px] border bg-white p-4.5" style={{ borderColor: T.BORDER }}>
                        <div className="mb-3.5" style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                            {t("app.automation.flow")}
                        </div>
                        <div className="flex items-start gap-2.5 pb-3">
                            <span className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: T.NAVY, color: T.WHITE }}>
                                <Icon name={triggerIcon(automation.trigger)} size={16} color={T.WHITE} />
                            </span>
                            <div className="min-w-0">
                                <div style={STEP_KICKER}>{t("app.automation.when")}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{td(triggerLabel(automation.trigger))}</div>
                                <div style={STEP_LINE}>{td(describeAutomationWait(automation, catalog))}</div>
                            </div>
                        </div>

                        {/* What has to be true before any action runs — every condition
                            must pass (AND), matching evaluateConditions() server-side. */}
                        <div className="flex items-start gap-2.5 py-2.5 border-t" style={{ borderColor: "#f4f5f7" }}>
                            <span
                                className="rounded-lg flex items-center justify-center shrink-0"
                                style={{ width: 30, height: 30, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}`, color: T.TEXT_MUTED }}
                            >
                                <Icon name="filter" size={15} color={T.TEXT_MUTED} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div style={STEP_KICKER}>{t("app.automation.conditions")}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                                    {td(describeConditionGate(automation))}
                                </div>
                                {automation.conditions.map((condition, i) => {
                                    const summary = describeCondition(condition, automation.subject_type, catalog);

                                    return (
                                        <div key={condition.id ?? i} className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                            {i > 0 && (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: T.TEXT_HINT }}>{td("AND")}</span>
                                            )}
                                            <span style={{ fontSize: 12, fontWeight: 600, color: T.TEXT }}>{td(summary.field)}</span>
                                            <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{td(summary.operator)}</span>
                                            {summary.value !== null && (
                                                <span
                                                    className="rounded px-1.5 py-0.5"
                                                    style={{ fontSize: 12, fontWeight: 600, color: T.NAVY, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}` }}
                                                >
                                                    {summary.value}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {automation.actions.map((step, i) => (
                            <div key={step.id ?? i} className="flex items-start gap-2.5 py-2.5 border-t" style={{ borderColor: "#f4f5f7" }}>
                                <span
                                    className="rounded-lg flex items-center justify-center shrink-0"
                                    style={{ width: 30, height: 30, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}`, color: T.TEXT_MUTED }}
                                >
                                    <Icon name={actionTypeIcon(step.action_type)} size={15} color={T.TEXT_MUTED} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div style={STEP_KICKER}>{`${t("app.automation.step")} ${i + 1}`}</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{td(actionTypeLabel(step.action_type))}</div>
                                    {describeAction(step, catalog).map((line) => (
                                        <div key={line} style={STEP_LINE}>
                                            {td(line)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {automation.actions.length === 0 && (
                            <div className="py-2.5 border-t" style={{ borderColor: "#f4f5f7", fontSize: 12, color: T.TEXT_HINT }}>
                                {td("No actions configured yet — this automation does nothing when it fires.")}
                            </div>
                        )}
                    </div>
                    <div className="rounded-[10px] border bg-white p-4.5" style={{ borderColor: T.BORDER }}>
                        <div className="mb-3" style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                            {t("app.automation.details")}
                        </div>
                        <div className="flex flex-col gap-2.5" style={{ fontSize: 13 }}>
                            <div className="flex justify-between">
                                <span style={{ color: T.TEXT_HINT }}>{t("app.automation.priority")}</span>
                                <span style={{ color: T.TEXT, fontWeight: 500 }}>{automation.priority}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: T.TEXT_HINT }}>{t("app.automation.conditions")}</span>
                                <span style={{ color: T.TEXT, fontWeight: 500 }}>{automation.conditions.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
