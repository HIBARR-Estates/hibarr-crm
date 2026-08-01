import { ReactNode } from "react";
import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

interface PanelHeaderProps {
    title: string;
    /** Wired to the dialog's aria-labelledby when used as a modal header. */
    titleId?: string;
    rightSlot?: ReactNode;
    onClose?: () => void;
    /** Accessible label for the close button. Defaults to "Close". */
    closeAriaLabel?: string;
}

/** Modal/panel header with optional close control. */
export default function PanelHeader({
    title,
    titleId,
    rightSlot,
    onClose,
    closeAriaLabel = "Close",
}: PanelHeaderProps) {
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
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                }}
            >
                {rightSlot}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeAriaLabel}
                        className="dr-btn dr-btn-sm"
                        style={{
                            background: T.WHITE,
                            color: T.TEXT_MUTED,
                            border: "none",
                        }}
                    >
                        <Icon name="x" size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
