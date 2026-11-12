import React from "react";
import { Phone, PhoneForwarded, PhoneIncoming, PhoneOff, X } from "lucide-react";
import useTranslation from "@/Hooks/useTranslation";
import type { SoftphoneCallFailure } from "@/lib/softphone/SoftphoneClient";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";

interface CallFailedNoticeProps {
    failure: SoftphoneCallFailure;
    devices: SoftphoneDeviceSummary[];
    activeDeviceId: number | null;
    onSelectDevice: (deviceId: number) => void;
    onRetry: () => void;
    onClose: () => void;
    isAnsweredElsewhere?: boolean;
}

/**
 * Notice displayed when a call ended, was answered elsewhere, or failed to connect.
 */
export default function CallFailedNotice({
    failure,
    devices,
    activeDeviceId,
    onSelectDevice,
    onRetry,
    onClose,
    isAnsweredElsewhere = false,
}: CallFailedNoticeProps) {
    const { t } = useTranslation();
    const activeLabel = devices.find((d) => d.id === activeDeviceId)?.label;
    const isInbound = failure.direction === "inbound";
    const answeredElsewhere = isAnsweredElsewhere || failure.code === "answered_elsewhere";
    const isDisconnected = failure.code === "disconnected";
    const isInboundOrNotice = isInbound || isDisconnected;

    if (isInboundOrNotice) {
        return (
            <section className="sp sp--notice" role="status" aria-label="Call status">
                <header className="sp__head">
                    <span className={`sp__dot ${answeredElsewhere ? "sp__dot--answered" : "sp__dot--notice"}`} />
                    {activeLabel ? `Softphone · ${activeLabel}` : "Softphone"}
                </header>
                <div className="sp__body">
                    <div
                        className={`sp__avatar ${answeredElsewhere ? "sp__avatar--answered" : "sp__avatar--notice"}`}
                        aria-hidden="true"
                    >
                        {answeredElsewhere ? (
                            <PhoneForwarded size={28} strokeWidth={1.7} />
                        ) : (
                            <PhoneIncoming size={28} strokeWidth={1.7} />
                        )}
                    </div>
                    <h2 className="sp__name">
                        {answeredElsewhere
                            ? t("pages.softphone.answered_elsewhere")
                            : isDisconnected
                              ? t("pages.softphone.call_disconnected")
                              : t("pages.softphone.call_ended")}
                    </h2>
                    <p className="sp__number">
                        {failure.direction === "outbound" ? "To" : "From"} {failure.context?.leadName || failure.peer}
                    </p>
                    {failure.context?.leadName && (
                        <p className="sp__number sp__number--peer">{failure.peer}</p>
                    )}
                    <p className="sp__reason sp__reason--notice">
                        {answeredElsewhere
                            ? "This call was answered on another device."
                            : failure.reason ||
                              (isDisconnected
                                  ? "The call was disconnected from the caller's end."
                                  : "The call ended before it was answered.")}
                    </p>

                    <div className="sp__actions">
                        {!answeredElsewhere && failure.peer && (
                            <button type="button" className="act" onClick={onRetry}>
                                <span className="act__btn">
                                    <Phone size={24} strokeWidth={2} />
                                </span>
                                {t("pages.softphone.call_back")}
                            </button>
                        )}
                        <button type="button" className="act" onClick={onClose}>
                            <span className="act__btn">
                                <X size={24} strokeWidth={2} />
                            </span>
                            {t("pages.softphone.close")}
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="sp sp--failed" role="alertdialog" aria-label="Call failed">
            <header className="sp__head">
                <span className="sp__dot sp__dot--failed" />
                {activeLabel ? `Phone · ${activeLabel}` : "Phone"}
            </header>
            <div className="sp__body">
                <div className="sp__avatar sp__avatar--failed" aria-hidden="true">
                    <PhoneOff size={30} strokeWidth={1.7} />
                </div>
                <h2 className="sp__name">Call failed</h2>
                <p className="sp__number">
                    {failure.direction === "outbound" ? "To" : "From"}{" "}
                    {failure.context?.leadName || failure.peer}
                </p>
                {failure.context?.leadName && (
                    <p className="sp__number sp__number--peer">{failure.peer}</p>
                )}
                <p className="sp__reason">{failure.reason}</p>

                {devices.length > 1 && (
                    <div className="sp__field" style={{ width: "100%", marginTop: 8 }}>
                        <span>Active line</span>
                        <select
                            value={activeDeviceId ?? ""}
                            onChange={(e) => onSelectDevice(Number(e.target.value))}
                            className="sp__select"
                        >
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="sp__actions">
                    <button type="button" className="act" onClick={onRetry}>
                        <span className="act__btn">
                            <Phone size={24} strokeWidth={2} />
                        </span>
                        Try again
                    </button>
                    <button type="button" className="act" onClick={onClose}>
                        <span className="act__btn">
                            <X size={24} strokeWidth={2} />
                        </span>
                        Close
                    </button>
                </div>
            </div>
        </section>
    );
}
