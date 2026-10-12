import { Link } from "@inertiajs/react";
import { Icon } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailUnreadCount from "@/Email/hooks/useEmailUnreadCount";

/**
 * Global new-mail badge for the signed-in mailbox owner. Visible even when
 * they are not the Lead Owner of any linked record. Two agents who each
 * received the same message both see their own indicator.
 */
export default function EmailUnreadIndicator() {
    const { t } = useTranslation();
    const { unread, available } = useEmailUnreadCount();

    if (!available) return null;

    const label =
        unread > 0
            ? t("pages.email.indicator.unread_aria").replace(
                  "{{count}}",
                  String(unread),
              )
            : t("pages.email.indicator.aria");

    return (
        <Link
            href="/email/review"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-dr-text no-underline hover:bg-dr-surface-2"
            aria-label={label}
            title={label}
            data-tour="email-unread-indicator"
            data-unread={unread}
        >
            <Icon name="mail" size={16} />
            {unread > 0 ? (
                <span
                    className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-dr-red px-1 text-[10px] font-semibold leading-4 text-white"
                    aria-hidden="true"
                    data-testid="email-unread-badge"
                >
                    {unread > 99 ? "99+" : unread}
                </span>
            ) : null}
        </Link>
    );
}
