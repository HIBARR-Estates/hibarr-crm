import { useMemo, useState } from "react";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Switch from "@/Components/Redesign/primitives/Switch";
import Icon from "@/Components/Redesign/primitives/Icon";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Automation } from "./types";
import { actionTypeIcon, actionTypeLabel, triggerIcon, triggerLabel } from "./shared";
import { describeConditionCount } from "./adapters/automationSummary";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useAutomationMutations from "./hooks/useAutomationMutations";

function RowSkeleton() {
    return (
        <div className="px-4.5 py-3.5 border-b last:border-b-0 animate-pulse" style={{ borderColor: "#f4f5f7" }}>
            <div className="h-4 w-1/3 rounded mb-2" style={{ background: "#eef1f5" }} />
            <div className="h-3 w-1/5 rounded" style={{ background: "#eef1f5" }} />
        </div>
    );
}

type StatusFilter = "all" | "active" | "paused";

interface AutomationsListProps {
    onOpenDetail: (id: number) => void;
    onEdit: (id: number) => void;
    onNewAutomation: () => void;
}

const ROW_GRID = "grid gap-3.5 items-center min-w-[760px]";
const ROW_COLS = { gridTemplateColumns: "minmax(120px,1.5fr) 150px minmax(150px,1.4fr) 78px 110px 96px" };

export default function AutomationsList({ onOpenDetail, onEdit, onNewAutomation }: AutomationsListProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { automations, automationsLoading, automationStats } = useAutomationWorkspace();
    const { toggleStatus, deleteAutomation } = useAutomationMutations();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<StatusFilter>("all");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return automations.filter((a) => {
            if (filter === "active" && !a.active) return false;
            if (filter === "paused" && a.active) return false;
            if (q && !a.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [automations, filter, query]);

    const filters: { key: StatusFilter; label: string }[] = [
        { key: "all", label: t("app.automation.filters.all") },
        { key: "active", label: t("app.automation.filters.active") },
        { key: "paused", label: t("app.automation.filters.paused") },
    ];

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {t("app.automation.automations")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.automationsSubtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <SearchOutlined
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{ left: 11, color: T.TEXT_HINT }}
                        />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("app.automation.searchAutomations")}
                            className="dr-input"
                            style={{ width: 220, paddingLeft: 32 }}
                        />
                    </div>
                    <Button variant="primary" icon={<PlusOutlined />} onClick={onNewAutomation}>
                        {t("app.automation.newAutomation")}
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 mb-3.5">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        className="dr-filter"
                        aria-pressed={filter === f.key}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="rounded-[10px] border bg-white overflow-x-auto" style={{ borderColor: T.BORDER }}>
                <div
                    className={`${ROW_GRID} px-4.5 py-2.5 border-b`}
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
                    <span>{t("app.automation.columns.automation")}</span>
                    <span>{t("app.automation.columns.trigger")}</span>
                    <span>{t("app.automation.columns.then")}</span>
                    <span className="text-right">{t("app.automation.columns.runs")}</span>
                    <span>{t("app.automation.columns.lastRun")}</span>
                    <span className="text-right">{t("app.automation.columns.status")}</span>
                </div>

                {automationsLoading && Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}

                {!automationsLoading && filtered.length === 0 && (
                    <div className="px-4.5 py-8">
                        <EmptyState
                            title={
                                automations.length === 0
                                    ? t("app.automation.noAutomationsYet")
                                    : t("app.automation.noAutomationsFound")
                            }
                            description={
                                automations.length === 0
                                    ? t("app.automation.noAutomationsYetDescription")
                                    : t("app.automation.noAutomationsFoundDescription")
                            }
                        />
                    </div>
                )}

                {!automationsLoading && filtered.map((a: Automation) => {
                    const stat = automationStats[a.id];
                    return (
                        <div
                            key={a.id}
                            className={`${ROW_GRID} px-4.5 py-3.5 border-b last:border-b-0`}
                            style={{ ...ROW_COLS, borderColor: "#f4f5f7" }}
                        >
                            <button
                                type="button"
                                onClick={() => onOpenDetail(a.id)}
                                className="border-0 bg-transparent text-left min-w-0 cursor-pointer p-0"
                                style={{ fontFamily: "inherit" }}
                            >
                                <div
                                    className="whitespace-nowrap overflow-hidden text-ellipsis"
                                    style={{ fontSize: 14, fontWeight: 600, color: T.TEXT }}
                                >
                                    {a.name}
                                </div>
                                <div
                                    className="whitespace-nowrap overflow-hidden text-ellipsis"
                                    style={{ fontSize: 12, color: T.TEXT_HINT }}
                                >
                                    {a.subject_type === "lead" ? t("app.automation.leadAutomation") : t("app.automation.dealAutomation")}
                                    {" · "}
                                    {td(describeConditionCount(a))}
                                </div>
                            </button>
                            <span>
                                <Badge variant="navy">
                                    <Icon name={triggerIcon(a.trigger)} size={13} />
                                    {td(triggerLabel(a.trigger))}
                                </Badge>
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                                {a.actions.map((act, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1.5 whitespace-nowrap"
                                        style={{
                                            padding: "3px 8px",
                                            borderRadius: 6,
                                            background: T.SURFACE_2,
                                            border: `1px solid ${T.BORDER_SOFT}`,
                                            fontSize: 12,
                                            color: T.TEXT_MUTED,
                                            fontWeight: 500,
                                        }}
                                    >
                                        <Icon name={actionTypeIcon(act.action_type)} size={13} color={T.TEXT_MUTED} />
                                        {td(actionTypeLabel(act.action_type))}
                                    </span>
                                ))}
                            </span>
                            <span className="text-right tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                                {(stat?.runs ?? 0).toLocaleString("en-US")}
                            </span>
                            <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                {stat?.last_run_at ? new Date(stat.last_run_at).toLocaleDateString() : "—"}
                            </span>
                            <span className="flex items-center justify-end gap-1.5">
                                <Switch
                                    checked={a.active}
                                    onChange={() => toggleStatus(a.id, !a.active)}
                                    aria-label={t("app.automation.toggleAutomation")}
                                />
                                <Dropdown
                                    trigger={["click"]}
                                    menu={{
                                        items: [
                                            { key: "edit", label: t("app.edit"), onClick: () => onEdit(a.id) },
                                            {
                                                key: "delete",
                                                label: t("app.delete"),
                                                danger: true,
                                                onClick: () => {
                                                    if (window.confirm(td("Delete this automation? This can't be undone."))) {
                                                        deleteAutomation(a.id);
                                                    }
                                                },
                                            },
                                        ],
                                    }}
                                >
                                    <button
                                        type="button"
                                        aria-label={t("app.automation.moreActions")}
                                        className="inline-flex items-center justify-center rounded-[7px] border bg-white cursor-pointer"
                                        style={{ padding: 6, borderColor: T.BORDER, color: T.TEXT_MUTED }}
                                    >
                                        <Icon name="more-vertical" size={16} />
                                    </button>
                                </Dropdown>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
