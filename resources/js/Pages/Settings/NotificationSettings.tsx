import React, { useEffect, useMemo, useState } from "react";
import { Card, Switch, Button, App, Skeleton } from "antd";
import type { TableColumnsType } from "antd";
import { BellOutlined, SaveOutlined } from "@ant-design/icons";
import { DataTable } from "@/Components/DataTable";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    useNotificationSettings,
    EmailNotificationSettingRow,
    ToggleColumn,
} from "@/Hooks/useNotificationSettings";

type Row = EmailNotificationSettingRow & { key: number };

const TOGGLE_COLUMNS: ToggleColumn[] = [
    "send_database",
    "send_email",
    "send_slack",
    "send_push",
];

const TOGGLE_COLUMN_WIDTH = 150;

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

export default function NotificationSettings({
    pageTitle,
}: {
    pageTitle: string;
}) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const {
        settings,
        statuses,
        isLoading,
        refetch,
        saveChangedColumns,
        isSaving,
    } = useNotificationSettings();

    const [original, setOriginal] = useState<EmailNotificationSettingRow[]>([]);
    const [rows, setRows] = useState<Row[]>([]);

    useEffect(() => {
        if (settings.length > 0) {
            setOriginal(settings);
            setRows(settings.map((row) => ({ ...row, key: row.id })));
        }
    }, [settings]);

    const hasChanges = useMemo(() => {
        return TOGGLE_COLUMNS.some((column) => {
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
        });
    }, [original, rows]);

    const toggleRow = (id: number, column: ToggleColumn) => {
        setRows((prev) =>
            prev.map((row) =>
                row.id === id
                    ? { ...row, [column]: row[column] === "yes" ? "no" : "yes" }
                    : row,
            ),
        );
    };

    const allEnabled = (column: ToggleColumn) =>
        rows.length > 0 && rows.every((row) => row[column] === "yes");

    const toggleAll = (column: ToggleColumn) => {
        const nextValue = allEnabled(column) ? "no" : "yes";
        setRows((prev) => prev.map((row) => ({ ...row, [column]: nextValue })));
    };

    const handleSave = async () => {
        const saved = await saveChangedColumns(original, rows);
        if (saved) {
            message.success(t("messages.updateSuccess"));
            refetch();
        }
    };

    const columnHeader = (
        label: string,
        column: ToggleColumn,
        connected?: boolean,
    ) => (
        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <span className="flex items-center gap-1.5">
                {connected !== undefined && (
                    <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{
                            backgroundColor: connected ? "#52c41a" : "#d9d9d9",
                        }}
                        title={
                            connected
                                ? t("app.settingsHub.connected")
                                : t("app.settingsHub.notConnected")
                        }
                    />
                )}
                {label}
            </span>
            <Switch size="small" checked={allEnabled(column)} onChange={() => toggleAll(column)} />
        </div>
    );

    const columns: TableColumnsType<Row> = [
        {
            title: t("modules.emailSettings.notificationTitle"),
            dataIndex: "setting_name",
            key: "setting_name",
            render: (_: unknown, record: Row) =>
                t(`modules.emailNotification.${slugifySettingName(record.setting_name)}`),
        },
        {
            title: columnHeader(t("app.menu.inAppNotifications"), "send_database"),
            key: "send_database",
            width: TOGGLE_COLUMN_WIDTH,
            align: "center" as const,
            render: (_: unknown, record: Row) => (
                <Switch
                    checked={record.send_database === "yes"}
                    onChange={() => toggleRow(record.id, "send_database")}
                />
            ),
        },
        {
            title: columnHeader(t("app.email"), "send_email"),
            key: "send_email",
            width: TOGGLE_COLUMN_WIDTH,
            align: "center" as const,
            render: (_: unknown, record: Row) => (
                <Switch
                    checked={record.send_email === "yes"}
                    onChange={() => toggleRow(record.id, "send_email")}
                />
            ),
        },
        {
            title: columnHeader(t("app.slack"), "send_slack", statuses?.slack ?? false),
            key: "send_slack",
            width: TOGGLE_COLUMN_WIDTH,
            align: "center" as const,
            render: (_: unknown, record: Row) => (
                <Switch
                    checked={record.send_slack === "yes"}
                    onChange={() => toggleRow(record.id, "send_slack")}
                />
            ),
        },
        {
            title: columnHeader(
                t("app.pushNotification"),
                "send_push",
                Boolean(statuses?.onesignal || statuses?.beams),
            ),
            key: "send_push",
            width: TOGGLE_COLUMN_WIDTH,
            align: "center" as const,
            render: (_: unknown, record: Row) => (
                <Switch
                    checked={record.send_push === "yes"}
                    onChange={() => toggleRow(record.id, "send_push")}
                />
            ),
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
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            disabled={!hasChanges}
                            loading={isSaving}
                        >
                            {t("app.save")}
                        </Button>
                    }
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 6 }} />
                    ) : (
                        <DataTable
                            dataSource={rows}
                            columns={columns}
                            size="middle"
                            scroll={{ x: "max-content" }}
                        />
                    )}
                </Card>
            </div>
        </PageLayout>
    );
}

NotificationSettings.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
