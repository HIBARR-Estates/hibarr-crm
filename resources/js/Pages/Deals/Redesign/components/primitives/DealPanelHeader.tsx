import { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import DealIcon from "./DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealPanelHeaderProps {
    title: string;
    /** Wired to the dialog's aria-labelledby when used as a modal header. */
    titleId?: string;
    rightSlot?: ReactNode;
    onClose?: () => void;
}

/** Ported from v2.2's Modal header (deal-v2-2.jsx:757-760). */
export default function DealPanelHeader({
    title,
    titleId,
    rightSlot,
    onClose,
}: DealPanelHeaderProps) {
    const { t } = useTranslation();
    return (
        <div
            style={{
                padding: "16px 18px",
                borderBottom: `1px solid ${T.BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
            }}
        >
            <span
                id={titleId}
                style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: T.TEXT,
                    whiteSpace: "nowrap",
                }}
            >
                {title}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {rightSlot}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("pages.deals.common.close")}
                        className="dr-btn dr-btn-sm"
                        style={{
                            background: T.WHITE,
                            color: T.TEXT_MUTED,
                            border: "none",
                        }}
                    >
                        <DealIcon name="x" size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
