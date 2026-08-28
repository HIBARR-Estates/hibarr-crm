import { useApiQuery, useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";

export interface EmailNotificationSettingRow {
    id: number;
    slug: string;
    setting_name: string;
    send_email: "yes" | "no";
    send_slack: "yes" | "no";
    send_push: "yes" | "no";
    send_database: "yes" | "no";
}

export interface NotificationSettingsStatuses {
    slack: boolean;
    onesignal: boolean;
    beams: boolean;
}

interface NotificationSettingsData {
    settings: EmailNotificationSettingRow[];
    statuses: NotificationSettingsStatuses;
}

export type ToggleColumn =
    | "send_email"
    | "send_slack"
    | "send_push"
    | "send_database";

const CHANNEL_BY_COLUMN: Record<ToggleColumn, string> = {
    send_email: "email",
    send_slack: "slack",
    send_push: "push",
    send_database: "database",
};

const enabledIdsFor = (rows: EmailNotificationSettingRow[], column: ToggleColumn) =>
    rows.filter((row) => row[column] === "yes").map((row) => row.id);

const enabledIdsKey = (rows: EmailNotificationSettingRow[], column: ToggleColumn) =>
    enabledIdsFor(rows, column).sort((a, b) => a - b).join(",");

/**
 * Loads all EmailNotificationSetting rows + channel connection statuses for the
 * React notification manager, and exposes one save that only PUTs the channels
 * whose enabled-id set actually changed since load (each channel is a separate
 * endpoint, matching the legacy Blade tabs' one-column-at-a-time save).
 */
export function useNotificationSettings() {
    const query = useApiQuery<ApiResponse<NotificationSettingsData>>({
        path: route("notification-settings-manager.data"),
    });

    const emailMutation = useApiMutate<{ enabled_ids: number[] }, unknown, ApiResponse>(
        route("notification-settings-manager.update", { channel: "email" }),
        "PUT",
    );
    const slackMutation = useApiMutate<{ enabled_ids: number[] }, unknown, ApiResponse>(
        route("notification-settings-manager.update", { channel: "slack" }),
        "PUT",
    );
    const pushMutation = useApiMutate<{ enabled_ids: number[] }, unknown, ApiResponse>(
        route("notification-settings-manager.update", { channel: "push" }),
        "PUT",
    );
    const databaseMutation = useApiMutate<{ enabled_ids: number[] }, unknown, ApiResponse>(
        route("notification-settings-manager.update", { channel: "database" }),
        "PUT",
    );

    const mutationByColumn: Record<ToggleColumn, typeof emailMutation> = {
        send_email: emailMutation,
        send_slack: slackMutation,
        send_push: pushMutation,
        send_database: databaseMutation,
    };

    /** Saves only the columns whose enabled-id set differs between the two snapshots. */
    const saveChangedColumns = async (
        original: EmailNotificationSettingRow[],
        current: EmailNotificationSettingRow[],
    ): Promise<boolean> => {
        const columns = Object.keys(CHANNEL_BY_COLUMN) as ToggleColumn[];
        const changed = columns.filter(
            (column) => enabledIdsKey(original, column) !== enabledIdsKey(current, column),
        );

        if (changed.length === 0) {
            return false;
        }

        await Promise.all(
            changed.map((column) =>
                mutationByColumn[column].mutateAsync({
                    enabled_ids: enabledIdsFor(current, column),
                }),
            ),
        );

        return true;
    };

    const responseData = query.data?.data as NotificationSettingsData | undefined;

    return {
        settings: responseData?.settings ?? [],
        statuses: responseData?.statuses,
        isLoading: query.isLoading,
        refetch: query.refetch,
        saveChangedColumns,
        isSaving:
            emailMutation.isPending ||
            slackMutation.isPending ||
            pushMutation.isPending ||
            databaseMutation.isPending,
    };
}
