import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { copyToClipboard } from "@/lib/utils";
import Button from "./Button";
import Icon from "./Icon";

interface CheckoutLinkActionsProps {
    url: string;
    /** Icon-only buttons (tooltip + aria-label) for tight spots like list rows. */
    compact?: boolean;
    /** Defaults to the compact row size. Dialogs pass the standard button size. */
    size?: "base" | "sm";
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
    size = "sm",
    className,
}: CheckoutLinkActionsProps) {
    const { t } = useTranslation();
    const { message } = App.useApp();

    const openLabel = t("pages.deals.payment_request.open_checkout");
    const copyLabel = t("pages.deals.payment_request.copy_link");
    const shareLabel = t("pages.deals.payment_request.share_link");
    const iconSize = size === "sm" ? 12 : 14;

    const handleCopy = async () => {
        try {
            await copyToClipboard(url);
            message.success(t("pages.deals.payment_request.link_copied"));
        } catch {
            message.error(t("pages.deals.payment_request.copy_failed"));
        }
    };

    const handleShare = async () => {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share({ url });
                return;
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return;
            }
        }
        await handleCopy();
    };

    const handleOpen = () => window.open(url, "_blank", "noopener,noreferrer");

    return (
        <div className={["flex items-center gap-1.5", className].filter(Boolean).join(" ")}>
            {!compact && (
                <Button
                    variant="ghost"
                    size={size}
                    icon={<Icon name="external-link" size={iconSize} />}
                    onClick={handleOpen}
                    aria-label={openLabel}
                >
                    {openLabel}
                </Button>
            )}
            <Button
                variant="ghost"
                size={size}
                icon={<Icon name="share" size={iconSize} />}
                onClick={() => void handleShare()}
                title={compact ? shareLabel : undefined}
                aria-label={shareLabel}
            >
                {compact ? null : shareLabel}
            </Button>
            <Button
                variant="ghost"
                size={size}
                icon={<Icon name="copy" size={iconSize} />}
                onClick={() => void handleCopy()}
                title={compact ? copyLabel : undefined}
                aria-label={copyLabel}
            >
                {compact ? null : copyLabel}
            </Button>
        </div>
    );
}
