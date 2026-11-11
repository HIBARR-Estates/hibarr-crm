import type { CSSProperties, ReactNode } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import { formatDateTime } from "@/Components/Redesign/adapters/dateFormat";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { AUDIT_EVENT_STYLE, AUDIT_SOURCE_ICON, RECORD_EVENTS } from "../config/auditLogEvents";
import { REDACTED_VALUE, fieldChanges, formatValue, humanizeField } from "../adapters/auditValues";
import type { AuditLogEntry } from "../types";

export const AUDIT_ROW_COLS: CSSProperties = {
    gridTemplateColumns: "150px minmax(140px,1fr) 150px minmax(200px,1.6fr) minmax(150px,1.2fr) 120px 20px",
};

export const AUDIT_ROW_GRID = "grid gap-3.5 items-center min-w-[1000px] px-4.5";

interface AuditLogRowProps {
    entry: AuditLogEntry;
    expanded: boolean;
    onToggle: () => void;
}

export default function AuditLogRow({ entry, expanded, onToggle }: AuditLogRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const style = AUDIT_EVENT_STYLE[entry.event] ?? AUDIT_EVENT_STYLE.updated;
    const changes = fieldChanges(entry);
    const isRecordEvent = RECORD_EVENTS.includes(entry.event);

    const summary = (() => {
        if (!isRecordEvent) return entry.ip_address ?? "—";
        if (changes.length === 0) return "—";
        const count =
            changes.length === 1
                ? t("app.auditLog.oneFieldChanged")
                : t("app.auditLog.fieldsChanged", { count: changes.length });
        if (entry.event !== "updated") return count;
        const names = changes.slice(0, 3).map((c) => td(humanizeField(c.key), { source: "en" })).join(", ");
        return `${count} · ${names}${changes.length > 3 ? "…" : ""}`;
    })();

    return (
        <div className="border-b last:border-b-0" style={{ borderColor: "#f4f5f7" }}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                className={`${AUDIT_ROW_GRID} py-3 cursor-pointer hover:bg-dr-surface-2`}
                style={AUDIT_ROW_COLS}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }}
            >
                <span className="tabular-nums" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                    {formatDateTime(entry.created_at)}
                </span>

                <span className="flex items-center gap-2 min-w-0">
                    {entry.user ? (
                        <>
                            <Avatar initials={initialsFromName(entry.user.name)} size={24} title={entry.user.name} />
                            <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                                {entry.user.name}
                            </span>
                        </>
                    ) : (
                        <span style={{ fontSize: 13, color: T.TEXT_HINT }}>{t("app.auditLog.system")}</span>
                    )}
                </span>

                <span>
                    <Badge variant={style.variant}>
                        <Icon name={style.icon} size={12} />
                        {t(`app.auditLog.events.${entry.event}`)}
                    </Badge>
                </span>

                <span className="min-w-0">
                    <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                        {entry.auditable.label ?? (entry.auditable.id ? `#${entry.auditable.id}` : "—")}
                    </span>
                    <span className="block truncate" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {td(entry.auditable.type_label, { source: "en" })}
                        {entry.auditable.id ? ` · #${entry.auditable.id}` : ""}
                    </span>
                </span>

                <span className="truncate" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                    {summary}
                </span>

                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                    {entry.source && (
                        <>
                            <Icon name={AUDIT_SOURCE_ICON[entry.source] ?? "info"} size={13} color={T.TEXT_HINT} />
                            {t(`app.auditLog.sources.${entry.source}`)}
                        </>
                    )}
                </span>

                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} color={T.TEXT_HINT} />
            </div>

            {expanded && <AuditLogEntryDetail entry={entry} />}
        </div>
    );
}

function AuditLogEntryDetail({ entry }: { entry: AuditLogEntry }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const changes = fieldChanges(entry);
    const showBefore = entry.event === "updated" || entry.event === "deleted";
    const showAfter = entry.event !== "deleted";

    const renderValue = (value: unknown): ReactNode => {
        if (value === null || value === undefined || value === "") {
            return <em style={{ color: T.TEXT_HINT }}>{t("app.auditLog.emptyValue")}</em>;
        }
        if (value === REDACTED_VALUE) {
            return <em style={{ color: T.TEXT_HINT }}>{t("app.auditLog.redacted")}</em>;
        }
        return <span className="break-words whitespace-pre-wrap">{formatValue(value)}</span>;
    };

    const context: { label: string; value: ReactNode }[] = [
        { label: t("app.auditLog.when"), value: formatDateTime(entry.created_at) },
        { label: t("app.auditLog.recordType"), value: td(entry.auditable.type_label, { source: "en" }) },
        { label: t("app.auditLog.recordId"), value: entry.auditable.id ?? "—" },
        {
            label: t("app.auditLog.origin"),
            value: entry.origin ? [entry.http_method, entry.origin].filter(Boolean).join(" ") : "—",
        },
        { label: t("app.auditLog.ipAddress"), value: entry.ip_address ?? "—" },
        { label: t("app.auditLog.device"), value: entry.user_agent ?? "—" },
    ];

    const headerStyle: CSSProperties = {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: T.GRAY_DARKER,
    };

    return (
        <div
            className="min-w-[1000px] px-4.5 py-3.5 grid gap-4"
            style={{
                gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)",
                background: T.SURFACE_2,
                borderTop: `1px solid ${T.BORDER}`,
            }}
        >
            <div className="rounded-lg bg-white overflow-hidden" style={{ border: `1px solid ${T.BORDER_SOFT}` }}>
                <div className="px-3 py-2 border-b" style={{ ...headerStyle, borderColor: T.BORDER_SOFT }}>
                    {t("app.auditLog.changes")}
                </div>
                {changes.length === 0 ? (
                    <div className="px-3 py-3" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {t("app.auditLog.noValues")}
                    </div>
                ) : (
                    <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: T.SURFACE_2 }}>
                                <th className="text-left px-3 py-1.5" style={{ ...headerStyle, width: "28%" }}>
                                    {t("app.auditLog.field")}
                                </th>
                                {showBefore && (
                                    <th className="text-left px-3 py-1.5" style={headerStyle}>
                                        {t("app.auditLog.before")}
                                    </th>
                                )}
                                {showAfter && (
                                    <th className="text-left px-3 py-1.5" style={headerStyle}>
                                        {t("app.auditLog.after")}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {changes.map((change) => (
                                <tr key={change.key} className="align-top" style={{ borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                                    <td className="px-3 py-1.5" style={{ color: T.TEXT_MUTED, fontWeight: 600 }} title={change.key}>
                                        {td(humanizeField(change.key), { source: "en" })}
                                    </td>
                                    {showBefore && (
                                        <td className="px-3 py-1.5" style={{ color: T.TEXT }}>
                                            {renderValue(change.before)}
                                        </td>
                                    )}
                                    {showAfter && (
                                        <td className="px-3 py-1.5" style={{ color: T.TEXT }}>
                                            {renderValue(change.after)}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="rounded-lg bg-white p-3 flex flex-col gap-2" style={{ border: `1px solid ${T.BORDER_SOFT}` }}>
                <div style={headerStyle}>{t("app.auditLog.details")}</div>
                {context.map((item) => (
                    <div key={item.label} className="flex flex-col">
                        <span style={{ fontSize: 11, color: T.TEXT_HINT }}>{item.label}</span>
                        <span className="break-all" style={{ fontSize: 12, color: T.TEXT }}>
                            {item.value}
                        </span>
                    </div>
                ))}
                {entry.auditable.url && (
                    <a
                        href={entry.auditable.url}
                        className="inline-flex items-center gap-1.5 mt-1"
                        style={{ fontSize: 12, fontWeight: 600, color: T.BLUE }}
                    >
                        <Icon name="external-link" size={13} color={T.BLUE} />
                        {t("app.auditLog.openRecord")}
                    </a>
                )}
            </div>
        </div>
    );
}
