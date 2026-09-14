import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type {
    TelephonyCallEntity,
    TelephonyCallResponse,
} from "@/Types/api/telephony";

const FEATURE_FLAG = "shared.3cx-calling";

function isNoExtensionError(status: number | undefined, serverMessage: string): boolean {
    const normalized = serverMessage.toLowerCase();

    return (
        status === 422 &&
        (normalized.includes("extension") ||
            normalized.includes("no_bound_extension") ||
            normalized.includes("not bound"))
    );
}

export default function useClickToCall() {
    const { props } = usePage<{ featureFlags?: Record<string, boolean> }>();
    const { t } = useTranslation();
    const [callingKey, setCallingKey] = useState<string | null>(null);

    const isEnabled = props.featureFlags?.[FEATURE_FLAG] === true;

    const initiateCall = useCallback(
        async (phone: string, entity: TelephonyCallEntity): Promise<boolean> => {
            const trimmedPhone = phone.trim();

            if (!trimmedPhone) {
                return false;
            }

            const requestKey = `${entity.type}:${entity.id}:${trimmedPhone}`;
            setCallingKey(requestKey);

            try {
                const response = await axios.post<TelephonyCallResponse>(
                    route("telephony.calls.store"),
                    {
                        phone: trimmedPhone,
                        entity_type: entity.type,
                        entity_id: entity.id,
                    },
                );

                if (response.data?.status === "success") {
                    message.success(
                        response.data.message ||
                            t("pages.telephony.success"),
                    );
                    return true;
                }

                message.error(
                    response.data?.message ||
                        t("pages.telephony.generic_error"),
                );
                return false;
            } catch (error: unknown) {
                const err = error as {
                    response?: {
                        status?: number;
                        data?: TelephonyCallResponse;
                    };
                };
                const status = err.response?.status;
                const serverMessage =
                    err.response?.data?.message?.trim() || "";

                if (status === 403) {
                    message.error(t("pages.telephony.permission_denied"));
                } else if (isNoExtensionError(status, serverMessage)) {
                    message.error(
                        serverMessage || t("pages.telephony.no_extension"),
                    );
                } else {
                    message.error(
                        serverMessage || t("pages.telephony.generic_error"),
                    );
                }

                return false;
            } finally {
                setCallingKey((current) =>
                    current === requestKey ? null : current,
                );
            }
        },
        [t],
    );

    const isCalling = useCallback(
        (phone: string, entity: TelephonyCallEntity) =>
            callingKey === `${entity.type}:${entity.id}:${phone.trim()}`,
        [callingKey],
    );

    return useMemo(
        () => ({
            isEnabled,
            initiateCall,
            isCalling,
            callingKey,
        }),
        [callingKey, initiateCall, isCalling, isEnabled],
    );
}
