import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Automation } from "./types";
import { actionTypeIcon, actionTypeLabel, statusToVariant, triggerIcon, triggerLabel } from "./shared";
import useAutomationStats from "./hooks/useAutomationStats";
import useAutomationLogs from "./hooks/useAutomationLogs";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";

interface AutomationDetailProps {
    automation: Automation;
    onBack: () => void;
    onEditFlow: () => void;
}

const BAR_MAX_FLOOR = 1;

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
        { label: t("app.automation.priority"), value: String(automation.priority), sub: "" },
    ];

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

            <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
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
                        <div className="flex items-center gap-2.5 pb-3">
                            <span className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: T.NAVY, color: T.WHITE }}>
                                <Icon name={triggerIcon(automation.trigger)} size={16} color={T.WHITE} />
                            </span>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_HINT }}>
                                    {t("app.automation.when")}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{td(triggerLabel(automation.trigger))}</div>
                            </div>
                        </div>
                        {automation.actions.map((step, i) => (
                            <div key={i} className="flex items-center gap-2.5 py-2.5 border-t" style={{ borderColor: "#f4f5f7" }}>
                                <span
                                    className="rounded-lg flex items-center justify-center shrink-0"
                                    style={{ width: 30, height: 30, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}`, color: T.TEXT_MUTED }}
                                >
                                    <Icon name={actionTypeIcon(step.action_type)} size={15} color={T.TEXT_MUTED} />
                                </span>
                                <div className="min-w-0">
                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{td(actionTypeLabel(step.action_type))}</div>
                                </div>
                            </div>
                        ))}
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
