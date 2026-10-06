import useTranslation from "@/Hooks/useTranslation";
import { visitBackTarget } from "@/lib/inertiaHistory";
import Button from "./Button";
import Icon from "./Icon";

interface BackButtonProps {
    /** Where to go when the origin is unknown (opened directly, new tab). */
    fallbackHref: string;
    /** Already-translated label; defaults to the generic "Back". */
    label?: string;
}

/**
 * Compact icon-only control, meant to sit inline beside the page title.
 * Returns to the page the user came from — including its query string, so a
 * filtered list comes back filtered — instead of the bare index route.
 */
export default function BackButton({ fallbackHref, label }: BackButtonProps) {
    const { t } = useTranslation();

    const text = label ?? t("pages.deals.common.back");

    return (
        <Button
            size="sm"
            icon={<Icon name="chevron-left" size={14} />}
            onClick={() => visitBackTarget(fallbackHref)}
            aria-label={text}
            title={text}
            style={{ padding: "0 6px", flexShrink: 0 }}
            data-testid="back-button"
        />
    );
}
