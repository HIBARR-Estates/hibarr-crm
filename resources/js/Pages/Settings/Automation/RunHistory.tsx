import { useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { LogStatus } from "./types";
import { channelIcon, statusToVariant } from "./shared";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useAutomationLogs from "./hooks/useAutomationLogs";

type StatusFilter = "all" | LogStatus;

const ROW_COLS = {
    gridTemplateColumns: "150px minmax(140px,1.2fr) minmax(120px,1fr) 110px 100px minmax(160px,1.4fr)",
};

function RowSkeleton() {
    return (
        <div
            className="grid gap-3.5 items-center min-w-[900px] px-4.5 py-3 border-b last:border-b-0 animate-pulse"
            style={{ ...ROW_COLS, borderColor: "#f4f5f7" }}
        >
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-3.5 rounded" style={{ background: "#eef1f5", width: i === 0 ? "70%" : "85%" }} />
            ))}
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

    const { logs, meta, loading } = useAutomationLogs({
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
                    <span>{t("app.automation.columns.channel")}</span>
                    <span>{t("app.automation.columns.result")}</span>
                    <span>{t("app.automation.columns.detail")}</span>
                </div>

                {loading && Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}

                {!loading && logs.length === 0 && (
                    <div className="px-4.5 py-8">
                        <EmptyState
                            title={t("app.automation.noActivityYet")}
                            description={t("app.automation.noActivityYetDescription")}
                        />
                    </div>
                )}

                {!loading && logs.map((entry) => (
                    <div
                        key={entry.id}
                        className="grid gap-3.5 items-center min-w-[900px] px-4.5 py-3 border-b last:border-b-0"
                        style={{ ...ROW_COLS, borderColor: "#f4f5f7" }}
                    >
                        <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {new Date(entry.executed_at).toLocaleString()}
                        </span>
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                            {entry.automation?.name ?? "—"}
                        </span>
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                            {entry.deal?.name ?? entry.lead?.client_name ?? "—"}
                        </span>
                        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                            <Icon name={channelIcon(entry.channel)} size={13} color={T.TEXT_HINT} />
                            {entry.channel ?? "—"}
                        </span>
                        <span>
                            <Badge variant={statusToVariant(entry.status)}>{t(`app.automation.results.${entry.status}`)}</Badge>
                        </span>
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {entry.action}
                        </span>
                    </div>
                ))}
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
