import { useState, useSyncExternalStore } from "react";
import { PhoneOutlined } from "@ant-design/icons";
import { message, Tooltip } from "antd";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import useClickToCall from "@/Hooks/useClickToCall";
import useTranslation from "@/Hooks/useTranslation";
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
    const [dialing, setDialing] = useState(false);

    const registration = useSyncExternalStore(
        (listener) => softphone.subscribe(listener),
        () => softphone.getState().registration,
        () => softphone.getState().registration,
    );
    const softphoneReady = registration === "registered";

    const trimmedPhone = phone.trim();
    if ((!softphoneEnabled && !olEnabled) || !trimmedPhone) {
        return null;
    }

    const useSoftphonePath = softphoneEnabled;
    const loading = useSoftphonePath ? dialing : isCalling(trimmedPhone, entity);

    const handleClick = () => {
        if (loading) {
            return;
        }

        if (useSoftphonePath) {
            if (!softphoneReady) {
                message.warning(
                    "Softphone is not registered — pick a line in the dock.",
                );
                return;
            }
            setDialing(true);
            void softphone
                .call(trimmedPhone)
                .then(() => message.info(`Calling ${trimmedPhone}…`))
                .catch(() => message.error(t("pages.telephony.generic_error")))
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
                disabled={loading}
                className={className}
            >
                <PhoneOutlined className="mr-1" />
                {label ?? t("pages.telephony.call")}
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
