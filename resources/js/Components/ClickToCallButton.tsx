import { PhoneOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
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

export default function ClickToCallButton({
    phone,
    entity,
    className = "",
    variant = "icon",
    label,
}: ClickToCallButtonProps) {
    const { t } = useTranslation();
    const { isEnabled, initiateCall, isCalling } = useClickToCall();
    const trimmedPhone = phone.trim();
    const loading = isCalling(trimmedPhone, entity);

    if (!isEnabled || !trimmedPhone) {
        return null;
    }

    const handleClick = () => {
        if (loading) {
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
