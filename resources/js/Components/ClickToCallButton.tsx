import { useEffect, useState, useSyncExternalStore } from "react";
import { PhoneOutlined } from "@ant-design/icons";
import { message, Tooltip } from "antd";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import useClickToCall from "@/Hooks/useClickToCall";
import useTranslation from "@/Hooks/useTranslation";
import axios from "axios";
import type { TelephonyCallEntity } from "@/Types/api/telephony";

interface ClickToCallButtonProps {
    phone: string;
    entity: TelephonyCallEntity;
    className?: string;
    /** Inline icon-only (DetailField) vs full-width label (Deal surfaces). */
    variant?: "icon" | "link";
    label?: string;
}

/**
 * Beside a phone number: originate a call. When the in-browser softphone is
 * on it dials via sipgate (audio in the tab); otherwise it falls back to the
 * OL click-to-call bridge. Reads registration state straight off the shared
 * SoftphoneClient singleton (the SoftphoneDock owns register/unregister) so a
 * button per number never triggers its own registration effects.
 */
export default function ClickToCallButton({
    phone,
    entity,
    className = "",
    variant = "icon",
    label,
}: ClickToCallButtonProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const { isEnabled: olEnabled, initiateCall, isCalling } = useClickToCall();
    const softphoneEnabled = props.featureFlags?.["shared.softphone"] === true;
    const permissionValue = props.auth?.permissions?.make_softphone_calls;
    const hasCallPermission = permissionValue === "all";
    const [dialing, setDialing] = useState(false);
    const [cooling, setCooling] = useState(false);
    const [coolingRemaining, setCoolingRemaining] = useState(0);

    useEffect(() => {
        if (!cooling) {
            setCoolingRemaining(0);
            return;
        }
        let remaining = 5;
        setCoolingRemaining(remaining);
        const id = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                setCooling(false);
                window.clearInterval(id);
            } else {
                setCoolingRemaining(remaining);
            }
        }, 1000);
        return () => {
            window.clearInterval(id);
        };
    }, [cooling]);

    const registration = useSyncExternalStore(
        (listener) => softphone.subscribe(listener),
        () => softphone.getState().registration,
        () => softphone.getState().registration,
    );
    const softphoneReady = registration === "registered";

    const trimmedPhone = phone.trim();
    if ((!softphoneEnabled && !olEnabled) || !trimmedPhone || !hasCallPermission) {
        return null;
    }

    const useSoftphonePath = softphoneEnabled;
    const loading = useSoftphonePath ? dialing : isCalling(trimmedPhone, entity);
    const cooldownSuffix = cooling ? ` (${coolingRemaining}s)` : "";

    const handleClick = () => {
        if (loading || cooling) {
            return;
        }

        if (useSoftphonePath) {
            if (
                typeof navigator === "undefined" ||
                !navigator.mediaDevices ||
                !window.isSecureContext
            ) {
                message.error(t("pages.telephony.insecure_context"));
                return;
            }
            if (!softphoneReady) {
                message.warning(
                    "Softphone is not registered — pick a line in the dock.",
                );
                return;
            }
            setDialing(true);
            void softphone
                // A phone rendered next to a lead already carries that lead —
                // pass it along instead of making the softphone go and look.
                .call(
                    trimmedPhone,
                    entity.type === "lead" ? { leadId: entity.id } : null,
                )
                .then(() => {
                    message.info(`Calling ${trimmedPhone}…`);
                    void axios
                        .post(route("telephony.softphone.events.store"), {
                            phone: trimmedPhone,
                            entity_type: entity.type,
                            entity_id: entity.id,
                            event: "call.started",
                        })
                        .catch(() => {
                            // Timeline logging is best-effort only.
                        });
                })
                .catch((error: unknown) => {
                    const detail =
                        error instanceof Error ? error.message?.trim() : "";
                    message.error(
                        detail || t("pages.telephony.generic_error"),
                    );
                    if (
                        detail &&
                        (detail.includes("603") ||
                            detail.toLowerCase().includes("decline"))
                    ) {
                        setCooling(true);
                    }
                })
                .finally(() => setDialing(false));
            return;
        }

        void initiateCall(trimmedPhone, entity);
    };

    if (variant === "link") {
        return (
            <button
                type="button"
                onClick={handleClick}
                disabled={loading || cooling}
                className={className}
            >
                <PhoneOutlined className="mr-1" />
                {cooling
                    ? `${label ?? t("pages.telephony.call")}${cooldownSuffix}`
                    : label ?? t("pages.telephony.call")}
            </button>
        );
    }

    return (
        <Tooltip title={t("pages.telephony.call")}>
            <PhoneOutlined
                role="button"
                aria-label={t("pages.telephony.call")}
                className={`mt-1 flex-shrink-0 cursor-pointer text-[11px] text-green-600 opacity-0 transition-opacity hover:text-green-700 group-hover:opacity-100 ${
                    loading ? "pointer-events-none opacity-50" : ""
                } ${className}`}
                onClick={handleClick}
            />
        </Tooltip>
    );
}
