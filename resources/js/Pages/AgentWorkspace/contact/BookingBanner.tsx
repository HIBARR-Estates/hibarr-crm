import Icon from "@/Components/Redesign/primitives/Icon";
import useCopyToClipboard from "@/Hooks/useCopyToClipboard";
import useTranslation from "@/Hooks/useTranslation";
import { stampIn, type BookingPending } from "./bookingPending";

interface BookingBannerProps {
    pending: BookingPending;
    name: string;
    nowMs: number;
    timeZone: string;
}

/**
 * The amber strip under the contact header while a consultation booking is
 * pending (canvas L7-26): when the link went out, and the link itself to copy
 * or open again for the client.
 */
export default function BookingBanner({ pending, name, nowMs, timeZone }: BookingBannerProps) {
    const { t, locale } = useTranslation();
    const { copy, copied, copyFailed } = useCopyToClipboard();
    const when = pending.openedAt ? stampIn(pending.openedAt, nowMs, timeZone, locale, t("pages.agent_workspace.today.title")) : "";

    return (
        <div className="agent-booking" role="status">
            <span className="agent-booking__pill">{t("pages.agent_workspace.contact.booking.pill")}</span>
            <span className="agent-booking__text">
                {when
                    ? t("pages.agent_workspace.contact.booking.text_when", { when, name })
                    : t("pages.agent_workspace.contact.booking.text", { name })}
            </span>
            <span className="agent-booking__actions">
                <button type="button" className="agent-booking__btn" onClick={() => void copy(pending.url)}>
                    <Icon name={copied ? "check" : "copy"} size={13} />
                    {copied
                        ? t("pages.agent_workspace.contact.booking.copied")
                        : copyFailed
                          ? t("pages.agent_workspace.contact.booking.copy_failed")
                          : t("pages.agent_workspace.contact.booking.copy")}
                </button>
                <a className="agent-booking__btn" href={pending.url} target="_blank" rel="noopener noreferrer">
                    <Icon name="external-link" size={13} />
                    {t("pages.agent_workspace.contact.booking.reopen")}
                </a>
            </span>
        </div>
    );
}

/** The pending consultation, held at the top of Coming up until the booking lands. */
export function BookingPendingRow({ name }: { name: string }) {
    const { t } = useTranslation();

    return (
        <li className="agent-upcoming agent-upcoming--pending">
            <div className="agent-upcoming__open">
                <span className="agent-upcoming__day">—</span>
                <span className="agent-upcoming__body">
                    <span className="agent-upcoming__title">{t("pages.agent_workspace.contact.booking.row_title")}</span>
                    <span className="agent-upcoming__sub">{t("pages.agent_workspace.contact.booking.row_sub", { name })}</span>
                </span>
                <span className="agent-upcoming__state">{t("pages.agent_workspace.contact.booking.row_state")}</span>
            </div>
        </li>
    );
}
