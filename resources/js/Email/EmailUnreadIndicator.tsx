import { Link } from "@inertiajs/react";
import { Mail } from "lucide-react";
import useTranslation from "@/Hooks/useTranslation";
import useEmailUnreadCount from "@/Email/hooks/useEmailUnreadCount";

/**
 * Global new-mail badge for the signed-in mailbox owner. Visible even when
 * they are not the Lead Owner of any linked record. Two agents who each
 * received the same message both see their own indicator.
 *
 * Spec: 44×44 round icon button, transparent, 18px stroke icon (stroke 1.8, color #4b5563), with aria-label.
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
            href="/email/inbox"
            className="relative inline-flex items-center justify-center rounded-full bg-transparent hover:bg-gray-100 text-[#4b5563] transition-colors no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
            }}
            aria-label={label}
            title={label}
            data-tour="email-unread-indicator"
            data-unread={unread}
        >
            <Mail size={18} strokeWidth={1.8} color="#4b5563" aria-hidden="true" />
            {unread > 0 ? (
                <span
                    className="absolute top-1 right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm"
                    aria-hidden="true"
                    data-testid="email-unread-badge"
                >
                    {unread > 99 ? "99+" : unread}
                </span>
            ) : null}
        </Link>
    );
}
