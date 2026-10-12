import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { copyToClipboard } from "@/lib/utils";
import Button from "./Button";
import Icon from "./Icon";

interface CheckoutLinkActionsProps {
    url: string;
    /** Icon-only buttons (tooltip + aria-label) for tight spots like list rows. */
    compact?: boolean;
    className?: string;
}

/**
 * The two things anyone does with a payment checkout link: open it, or copy
 * it to send to the client. Never render the raw URL next to these — it's a
 * long opaque string; the buttons are the interface.
 */
export default function CheckoutLinkActions({
    url,
    compact = false,
    className,
}: CheckoutLinkActionsProps) {
    const { t } = useTranslation();
    const { message } = App.useApp();

    const openLabel = t("pages.deals.payment_request.open_checkout");
    const copyLabel = t("pages.deals.payment_request.copy_link");

    const handleCopy = async () => {
        try {
            await copyToClipboard(url);
            message.success(t("pages.deals.payment_request.link_copied"));
        } catch {
            message.error(t("pages.deals.payment_request.copy_failed"));
        }
    };

    const handleOpen = () => window.open(url, "_blank", "noopener,noreferrer");

    return (
        <div className={["flex items-center gap-1.5", className].filter(Boolean).join(" ")}>
            <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="external-link" size={12} />}
                onClick={handleOpen}
                title={compact ? openLabel : undefined}
                aria-label={openLabel}
            >
                {compact ? null : openLabel}
            </Button>
            <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="copy" size={12} />}
                onClick={() => void handleCopy()}
                title={compact ? copyLabel : undefined}
                aria-label={copyLabel}
            >
                {compact ? null : copyLabel}
            </Button>
        </div>
    );
}
