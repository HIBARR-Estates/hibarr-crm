import { useState } from "react";
import axios from "axios";
import { App } from "antd";

/**
 * Hook to grant or revoke softphone access for an agent.
 * When deviceId is provided, revokes or grants access specifically for that line,
 * without removing the user from the pool or affecting other lines.
 */
export function usePermissionToggle(
    onRefetch: () => Promise<unknown> | void,
    deviceId?: number | null,
) {
    const { message } = App.useApp();
    const [togglingUserIds, setTogglingUserIds] = useState<Record<number, boolean>>({});

    const togglePermission = async (userId: number, currentPermission: boolean) => {
        setTogglingUserIds((previous) => ({ ...previous, [userId]: true }));
        try {
            const payload: { user_id: number; enabled: boolean; device_id?: number } = {
                user_id: userId,
                enabled: !currentPermission,
            };
            if (deviceId != null) {
                payload.device_id = deviceId;
            }

            const response = await axios.post<{ status: string; message: string }>(
                route("telephony.softphone.call-pool.toggle-permission"),
                payload,
                { headers: { Accept: "application/json" } },
            );
            void message.success(
                response.data?.message || (!currentPermission ? "Softphone access granted." : "Softphone access revoked."),
            );
            await onRefetch();
        } catch (error: any) {
            const errorMessage =
                error?.response?.data?.message || "Could not update softphone access.";
            void message.error(errorMessage);
        } finally {
            setTogglingUserIds((previous) => ({ ...previous, [userId]: false }));
        }
    };

    return { togglingUserIds, togglePermission };
}
