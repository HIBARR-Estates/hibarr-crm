import { PlusOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Switch from "@/Components/Redesign/primitives/Switch";
import Icon from "@/Components/Redesign/primitives/Icon";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { Automation } from "./types";
import { channelIcon, statusIconWrap, statusToVariant, triggerIcon } from "./shared";
import useAutomationStats from "./hooks/useAutomationStats";
import useAutomationLogs from "./hooks/useAutomationLogs";
import useAutomationMutations from "./hooks/useAutomationMutations";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 py-2.5 border-b last:border-b-0 animate-pulse" style={{ borderColor: "#f4f5f7" }}>
            <span className="w-[34px] h-[34px] rounded-lg shrink-0" style={{ background: "#eef1f5" }} />
            <div className="min-w-0 flex-1">
                <div className="h-3.5 w-2/3 rounded mb-1.5" style={{ background: "#eef1f5" }} />
                <div className="h-3 w-1/3 rounded" style={{ background: "#eef1f5" }} />
            </div>
        </div>
    );
}

interface OverviewProps {
    onOpenAutomation: (id: number) => void;
    onNewAutomation: () => void;
    onManageAutomations: () => void;
    onViewAllLogs: () => void;
}

export default function Overview({
    onOpenAutomation,
    onNewAutomation,
    onManageAutomations,
    onViewAllLogs,
}: OverviewProps) {
    const { t } = useTranslation();
    const { automations, automationsLoading, automationStats } = useAutomationWorkspace();
    const { toggleStatus } = useAutomationMutations();
    const { stats, loading: statsLoading } = useAutomationStats();
    const { runs, loading: logsLoading } = useAutomationLogs({});

    const activeCount = automations.filter((a) => a.active).length;
    const pausedCount = automations.length - activeCount;
    const runsLast7Days = stats?.runs_last_7_days ?? [];
    const runsToday = runsLast7Days.length ? runsLast7Days[runsLast7Days.length - 1].value : 0;
    const runs7dTotal = runsLast7Days.reduce((sum, d) => sum + d.value, 0);

    const tiles = [
        {
            label: t("app.automation.stats.activeAutomations"),
            value: String(activeCount),
            sub: t("app.automation.stats.pausedCount", { count: pausedCount }),
            subColor: T.TEXT_MUTED,
        },
        {
            label: t("app.automation.stats.runsToday"),
            value: String(runsToday),
            sub: "",
            subColor: T.GREEN,
        },
        {
            label: t("app.automation.stats.runsLast7d"),
            value: runs7dTotal.toLocaleString("en-US"),
            sub: "",
            subColor: T.GREEN,
        },
        {
            label: t("app.automation.stats.successRate"),
            value: stats?.success_rate != null ? `${stats.success_rate}%` : "—",
            sub: t("app.automation.stats.allTime"),
            subColor: T.TEXT_MUTED,
        },
    ];

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {t("app.automation.overview")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.overviewSubtitle")}
                    </p>
                </div>
                <Button variant="primary" icon={<PlusOutlined />} onClick={onNewAutomation}>
                    {t("app.automation.newAutomation")}
                </Button>
            </div>

            <div className="grid grid-cols-4 gap-3.5 mb-4">
                {tiles.map((st) => (
                    <div
                        key={st.label}
                        className="rounded-[10px] border bg-white p-4"
                        style={{ borderColor: T.BORDER }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                                textTransform: "uppercase",
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {st.label}
                        </div>
                        {statsLoading ? (
                            <div className="animate-pulse h-7 w-16 rounded mt-2 mb-1" style={{ background: "#eef1f5" }} />
                        ) : (
                            <div
                                className="leading-none"
                                style={{ fontSize: 28, fontWeight: 700, color: T.NAVY, margin: "8px 0 3px" }}
                            >
                                {st.value}
                            </div>
                        )}
                        {st.sub && !statsLoading && (
                            <div style={{ fontSize: 12, fontWeight: 500, color: st.subColor }}>{st.sub}</div>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid gap-4 items-stretch" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
                <div className="rounded-[10px] border bg-white flex flex-col" style={{ borderColor: T.BORDER, height: "75vh" }}>
                    <div
                        className="flex items-center justify-between px-4.5 py-3.5 border-b shrink-0"
                        style={{ borderColor: T.BORDER_SOFT }}
                    >
                        <span style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                            {t("app.automation.recentActivity")}
                        </span>
                        <button
                            type="button"
                            onClick={onViewAllLogs}
                            className="border-0 bg-transparent cursor-pointer"
                            style={{ fontSize: 12, fontWeight: 600, color: T.BLUE }}
                        >
                            {t("app.automation.viewAll")}
                        </button>
                    </div>
                    <div className="px-4.5 pb-2.5 pt-1.5 flex-1" style={{ overflowY: "auto" }}>
                        {logsLoading && Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
                        {!logsLoading && runs.length === 0 && (
                            <div className="py-4">
                                <EmptyState
                                    title={t("app.automation.noActivityYet")}
                                    description={t("app.automation.noActivityYetDescription")}
                                />
                            </div>
                        )}
                        {!logsLoading && runs.map((entry) => (
                            <div
                                key={entry.run_id}
                                className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
                                style={{ borderColor: "#f4f5f7" }}
                            >
                                <span
                                    className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                                    style={statusIconWrap(entry.status)}
                                >
                                    <Icon name={channelIcon(entry.steps[0]?.channel ?? null)} size={16} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                                        {entry.automation?.name ?? "—"}
                                    </div>
                                    <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 1 }}>
                                        {entry.deal?.name ?? entry.lead?.client_name ?? "—"}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <Badge variant={statusToVariant(entry.status)}>
                                        {t(`app.automation.results.${entry.status}`)}
                                    </Badge>
                                    <div style={{ fontSize: 11, color: T.TEXT_HINT, marginTop: 4 }}>
                                        {new Date(entry.executed_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[10px] border bg-white flex flex-col" style={{ borderColor: T.BORDER, height: "75vh" }}>
                    <div
                        className="flex items-center justify-between px-4.5 py-3.5 border-b shrink-0"
                        style={{ borderColor: T.BORDER_SOFT }}
                    >
                        <span style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                            {t("app.automation.yourAutomations")}
                        </span>
                        <button
                            type="button"
                            onClick={onManageAutomations}
                            className="border-0 bg-transparent cursor-pointer"
                            style={{ fontSize: 12, fontWeight: 600, color: T.BLUE }}
                        >
                            {t("app.automation.manage")}
                        </button>
                    </div>
                    <div className="px-4.5 pt-1.5 pb-3 flex-1" style={{ overflowY: "auto" }}>
                        {automationsLoading && Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
                        {!automationsLoading && automations.length === 0 && (
                            <div className="py-4">
                                <EmptyState
                                    title={t("app.automation.noAutomationsYet")}
                                    description={t("app.automation.noAutomationsYetDescription")}
                                />
                            </div>
                        )}
                        {!automationsLoading && automations.map((a: Automation) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-2.5 py-2.5 border-b last:border-b-0"
                                style={{ borderColor: "#f4f5f7" }}
                            >
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: a.active ? T.GREEN : T.NAVY_MID }}
                                />
                                <button
                                    type="button"
                                    onClick={() => onOpenAutomation(a.id)}
                                    className="border-0 bg-transparent text-left min-w-0 flex-1 cursor-pointer p-0"
                                    style={{ fontFamily: "inherit" }}
                                >
                                    <div
                                        className="whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5"
                                        style={{ fontSize: 13, fontWeight: 500, color: T.TEXT }}
                                    >
                                        <Icon name={triggerIcon(a.trigger)} size={12} color={T.TEXT_HINT} />
                                        {a.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                                        {t("app.automation.runsCount", {
                                            count: (automationStats[a.id]?.runs ?? 0).toLocaleString("en-US"),
                                        })}
                                    </div>
                                </button>
                                <Switch
                                    checked={a.active}
                                    onChange={() => toggleStatus(a.id, !a.active)}
                                    aria-label={t("app.automation.toggleAutomation")}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
