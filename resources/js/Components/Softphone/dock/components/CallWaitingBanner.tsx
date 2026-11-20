import { PhoneIncoming } from "lucide-react";
import useTranslation from "@/Hooks/useTranslation";

interface CallWaitingBannerProps {
    /** Lead name when the agent may see it; otherwise the number is shown. */
    name: string | null;
    peer: string;
    onAnswer: () => void;
    onDecline: () => void;
}

/**
 * A second call ringing while the agent is on one. Answering ends the
 * current call first; declining passes the call to the next agent.
 */
export default function CallWaitingBanner({ name, peer, onAnswer, onDecline }: CallWaitingBannerProps) {
    const { t } = useTranslation();

    return (
        <div className="sp__waiting" role="alert" aria-live="assertive">
            <div className="sp__waiting-info">
                <span className="sp__waiting-icon" aria-hidden="true">
                    <PhoneIncoming size={16} strokeWidth={2} />
                </span>
                <span className="sp__waiting-text">
                    <strong>{t("pages.softphone.call_waiting")}</strong>
                    <span className="sp__waiting-who">{name || peer}</span>
                </span>
            </div>
            <div className="sp__waiting-actions">
                <button type="button" className="sp__waiting-btn" onClick={onDecline}>
                    {t("pages.softphone.decline_waiting")}
                </button>
                <button type="button" className="sp__waiting-btn sp__waiting-btn--answer" onClick={onAnswer}>
                    {t("pages.softphone.end_and_answer")}
                </button>
            </div>
        </div>
    );
}
