import React, { useEffect, useMemo, useState } from "react";
import { Card, App, Skeleton } from "antd";
import { BellOutlined } from "@ant-design/icons";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Icon from "@/Components/Redesign/primitives/Icon";
import Switch from "@/Components/Redesign/primitives/Switch";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDebounce } from "@/Hooks/useDebounce";
import {
    useNotificationSettings,
    EmailNotificationSettingRow,
    ToggleColumn,
} from "@/Hooks/useNotificationSettings";
import {
    NOTIFICATION_GROUP_ORDER,
    NotificationSettingGroup,
    resolveNotificationGroup,
} from "./config/notificationSettingGroups";
import "@/Components/Redesign/redesign.css";

const TOGGLE_COLUMNS: ToggleColumn[] = [
    "send_database",
    "send_email",
    "send_slack",
    "send_push",
];

/** Name column flexes; the four channel columns stay aligned across sections. */
const GRID_TEMPLATE = "minmax(220px, 1fr) repeat(4, 96px)";
const GRID_MIN_WIDTH = 660;

type GroupedRow = EmailNotificationSettingRow & {
    group: NotificationSettingGroup;
    label: string;
};

/**
 * Mirrors Laravel's Str::slug() closely enough for these labels — the Blade
 * checkboxes look up modules.emailNotification.{str_slug(setting_name)},
 * which sometimes differs from the row's own `slug` column (e.g. "Task
 * Rejected From Review" has slug "task-rejected"). Matching Blade's basis
 * keeps both UIs resolving the same translation key for the same row.
 */
function slugifySettingName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Checked when every row is on, mixed when only some are. */
function channelState(
    rows: EmailNotificationSettingRow[],
    column: ToggleColumn,
): { checked: boolean; indeterminate: boolean } {
    if (rows.length === 0) {
        return { checked: false, indeterminate: false };
    }
    let enabled = 0;
    for (const row of rows) {
        if (row[column] === "yes") enabled += 1;
    }
    return {
        checked: enabled === rows.length,
        indeterminate: enabled > 0 && enabled < rows.length,
    };
}

export default function NotificationSettings({
    pageTitle,
}: {
    pageTitle: string;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const {
        settings,
        statuses,
        isLoading,
        saveChangedColumns,
        isSaving,
    } = useNotificationSettings();

    const [original, setOriginal] = useState<EmailNotificationSettingRow[]>([]);
    const [rows, setRows] = useState<EmailNotificationSettingRow[]>([]);
    const [query, setQuery] = useState("");
    const [collapsed, setCollapsed] = useState<Set<string>>(
        () => new Set(NOTIFICATION_GROUP_ORDER),
    );

    /** True while `rows` holds edits not yet reflected in `original` (queued for, or mid, autosave). */
    const hasPendingChanges = useMemo(
        () =>
            TOGGLE_COLUMNS.some((column) => {
                const before = original
                    .filter((row) => row[column] === "yes")
                    .map((row) => row.id)
                    .sort()
                    .join(",");
                const after = rows
                    .filter((row) => row[column] === "yes")
                    .map((row) => row.id)
                    .sort()
                    .join(",");
                return before !== after;
            }),
        [original, rows],
    );

    useEffect(() => {
        // A background refetch (window refocus, cache invalidation, ...)
        // must not clobber an edit the user just made that hasn't saved yet.
        if (settings.length > 0 && !hasPendingChanges) {
            setOriginal(settings);
            setRows(settings);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings]);

    /** Debounced so a burst of toggles (e.g. a bulk switch) collapses into one save. */
    const debouncedRows = useDebounce(rows, 500);

    useEffect(() => {
        if (debouncedRows.length === 0) return;
        let cancelled = false;

        (async () => {
            try {
                const saved = await saveChangedColumns(original, debouncedRows);
                if (!cancelled && saved) {
                    setOriginal(debouncedRows);
                }
            } catch {
                if (!cancelled) {
                    message.error(t("messages.somethingWentWrong"));
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedRows]);

    const decorated = useMemo<GroupedRow[]>(
        () =>
            rows.map((row) => ({
                ...row,
                group: resolveNotificationGroup(row.slug, row.setting_name),
                label: t(
                    `modules.emailNotification.${slugifySettingName(row.setting_name)}`,
                ),
            })),
        [rows, t],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === "") return decorated;
        return decorated.filter(
            (row) =>
                row.label.toLowerCase().includes(q) ||
                row.setting_name.toLowerCase().includes(q) ||
                row.group.toLowerCase().includes(q),
        );
    }, [decorated, query]);

    /**
     * The header switches act on what is on screen: everything by default, and
     * only the matches while a search narrows the list.
     */
    const scoped = query.trim() === "" ? rows : filtered;

    /** One section per model, in NOTIFICATION_GROUP_ORDER; empty groups drop out. */
    const grouped = useMemo(() => {
        const map = new Map<NotificationSettingGroup, GroupedRow[]>();
        for (const row of filtered) {
            const list = map.get(row.group) ?? [];
            list.push(row);
            map.set(row.group, list);
        }
        return NOTIFICATION_GROUP_ORDER.filter((group) => map.has(group)).map(
            (group) => [group, map.get(group) as GroupedRow[]] as const,
        );
    }, [filtered]);

    const setColumnFor = (ids: Set<number>, column: ToggleColumn, value: "yes" | "no") => {
        setRows((prev) =>
            prev.map((row) =>
                ids.has(row.id) ? { ...row, [column]: value } : row,
            ),
        );
    };

    const toggleRow = (id: number, column: ToggleColumn) => {
        setRows((prev) =>
            prev.map((row) =>
                row.id === id
                    ? { ...row, [column]: row[column] === "yes" ? "no" : "yes" }
                    : row,
            ),
        );
    };

    /** Bulk toggle for a set of rows (a model section, or every row for the header). */
    const toggleMany = (target: EmailNotificationSettingRow[], column: ToggleColumn) => {
        if (target.length === 0) return;
        const { checked } = channelState(target, column);
        setColumnFor(
            new Set(target.map((row) => row.id)),
            column,
            checked ? "no" : "yes",
        );
    };

    const toggleCollapsed = (group: string) => {
        setCollapsed((current) => {
            const copy = new Set(current);
            if (copy.has(group)) copy.delete(group);
            else copy.add(group);
            return copy;
        });
    };

    const channels: {
        column: ToggleColumn;
        label: string;
        connected?: boolean;
    }[] = [
        { column: "send_database", label: t("app.menu.inAppNotifications") },
        { column: "send_email", label: t("app.email") },
        {
            column: "send_slack",
            label: t("app.slack"),
            connected: statuses?.slack ?? false,
        },
        {
            column: "send_push",
            label: t("app.pushNotification"),
            connected: Boolean(statuses?.onesignal || statuses?.beams),
        },
    ];

    const breadcrumbs = [
        { name: t("app.menu.settings"), url: route("settings-overview.index") },
        { name: pageTitle },
    ];

    return (
        <PageLayout title={pageTitle} breadcrumbs={breadcrumbs} config={{ showTitle: true }}>
            <div className="max-w-screen-2xl mx-auto">
                <Card
                    title={
                        <div className="flex items-center gap-2">
                            <BellOutlined />
                            <span>{pageTitle}</span>
                        </div>
                    }
                    extra={
                        isSaving ? (
                            <span
                                style={{
                                    fontSize: REDESIGN_TYPE.CAPTION,
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                {td("Saving…", { source: "en" })}
                            </span>
                        ) : null
                    }
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 6 }} />
                    ) : (
                        <>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={td("Search notification types", { source: "en" })}
                                aria-label={td("Search notification types", { source: "en" })}
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                    fontSize: REDESIGN_TYPE.BODY,
                                    color: T.TEXT,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 8,
                                    padding: "8px 12px",
                                    marginBottom: 16,
                                    background: T.WHITE,
                                }}
                            />

                            <div style={{ overflowX: "auto" }}>
                                <div style={{ minWidth: GRID_MIN_WIDTH }}>
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: GRID_TEMPLATE,
                                            alignItems: "end",
                                            gap: 8,
                                            padding: "0 12px 10px",
                                            borderBottom: `1px solid ${T.BORDER}`,
                                            marginBottom: 12,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: REDESIGN_TYPE.CAPTION,
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                color: T.GRAY_DARKER,
                                            }}
                                        >
                                            {t("modules.emailSettings.notificationTitle")}
                                        </span>
                                        {channels.map((channel) => {
                                            const state = channelState(scoped, channel.column);
                                            return (
                                                <div
                                                    key={channel.column}
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        gap: 6,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 5,
                                                            fontSize: REDESIGN_TYPE.CAPTION,
                                                            fontWeight: 600,
                                                            color: T.TEXT_MUTED,
                                                            textAlign: "center",
                                                            lineHeight: 1.3,
                                                        }}
                                                    >
                                                        {channel.connected !== undefined && (
                                                            <span
                                                                style={{
                                                                    display: "inline-block",
                                                                    width: 8,
                                                                    height: 8,
                                                                    flexShrink: 0,
                                                                    borderRadius: "50%",
                                                                    backgroundColor: channel.connected
                                                                        ? "#52c41a"
                                                                        : "#d9d9d9",
                                                                }}
                                                                title={
                                                                    channel.connected
                                                                        ? t("app.settingsHub.connected")
                                                                        : t("app.settingsHub.notConnected")
                                                                }
                                                            />
                                                        )}
                                                        {channel.label}
                                                    </span>
                                                    <Switch
                                                        checked={state.checked}
                                                        indeterminate={state.indeterminate}
                                                        onChange={() =>
                                                            toggleMany(scoped, channel.column)
                                                        }
                                                        aria-label={`${td("All", { source: "en" })} ${channel.label}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {grouped.length === 0 ? (
                                        <EmptyState
                                            title={td("No matching notification types", { source: "en" })}
                                            description={td("Try a different search.", { source: "en" })}
                                        />
                                    ) : (
                                        grouped.map(([group, items]) => {
                                            // A search result always shows its matches, whatever
                                            // the section's collapsed state was before.
                                            const isOpen =
                                                query.trim() !== "" || !collapsed.has(group);
                                            return (
                                                <div key={group} style={{ marginBottom: 10 }}>
                                                    <div
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns: GRID_TEMPLATE,
                                                            alignItems: "center",
                                                            gap: 8,
                                                            border: `1px solid ${T.BORDER}`,
                                                            borderRadius: isOpen ? "8px 8px 0 0" : 8,
                                                            padding: "8px 12px",
                                                            background: T.SURFACE_2,
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCollapsed(group)}
                                                            aria-expanded={isOpen}
                                                            style={{
                                                                appearance: "none",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 8,
                                                                margin: 0,
                                                                padding: 0,
                                                                border: 0,
                                                                background: "transparent",
                                                                cursor: "pointer",
                                                                fontFamily: "inherit",
                                                                textAlign: "left",
                                                                minWidth: 0,
                                                            }}
                                                        >
                                                            <Icon
                                                                name={isOpen ? "chevron-up" : "chevron-down"}
                                                                size={14}
                                                                color={T.GRAY_DARK}
                                                            />
                                                            <span
                                                                style={{
                                                                    fontSize: REDESIGN_TYPE.CAPTION,
                                                                    fontWeight: 700,
                                                                    textTransform: "uppercase",
                                                                    letterSpacing: "0.05em",
                                                                    color: T.GRAY_DARKER,
                                                                }}
                                                            >
                                                                {td(group, { source: "en" })}
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontSize: REDESIGN_TYPE.CAPTION,
                                                                    color: T.TEXT_MUTED,
                                                                }}
                                                            >
                                                                {items.length}
                                                            </span>
                                                        </button>
                                                        {channels.map((channel) => {
                                                            const state = channelState(items, channel.column);
                                                            return (
                                                                <div
                                                                    key={channel.column}
                                                                    style={{
                                                                        display: "flex",
                                                                        justifyContent: "center",
                                                                    }}
                                                                >
                                                                    <Switch
                                                                        checked={state.checked}
                                                                        indeterminate={state.indeterminate}
                                                                        onChange={() =>
                                                                            toggleMany(items, channel.column)
                                                                        }
                                                                        aria-label={`${group} — ${channel.label}`}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {isOpen ? (
                                                        <div
                                                            style={{
                                                                border: `1px solid ${T.BORDER}`,
                                                                borderTop: "none",
                                                                borderRadius: "0 0 8px 8px",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            {items.map((row, index) => (
                                                                <div
                                                                    key={row.id}
                                                                    style={{
                                                                        display: "grid",
                                                                        gridTemplateColumns: GRID_TEMPLATE,
                                                                        alignItems: "center",
                                                                        gap: 8,
                                                                        padding: "10px 12px",
                                                                        borderTop:
                                                                            index === 0
                                                                                ? "none"
                                                                                : `1px solid ${T.BORDER_SOFT}`,
                                                                        background: T.WHITE,
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            fontSize: REDESIGN_TYPE.BODY,
                                                                            color: T.TEXT,
                                                                        }}
                                                                    >
                                                                        {row.label}
                                                                    </span>
                                                                    {channels.map((channel) => (
                                                                        <div
                                                                            key={channel.column}
                                                                            style={{
                                                                                display: "flex",
                                                                                justifyContent: "center",
                                                                            }}
                                                                        >
                                                                            <Switch
                                                                                checked={row[channel.column] === "yes"}
                                                                                onChange={() =>
                                                                                    toggleRow(row.id, channel.column)
                                                                                }
                                                                                aria-label={`${row.label} — ${channel.label}`}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </PageLayout>
    );
}

NotificationSettings.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
