import { ReactNode } from "react";
import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

interface PanelHeaderProps {
    title: string;
    /** Second line under the title, e.g. what the dialog is acting on. */
    subtitle?: ReactNode;
    /** Wired to the dialog's aria-labelledby when used as a modal header. */
    titleId?: string;
    rightSlot?: ReactNode;
    onClose?: () => void;
    /** Accessible label for the close button. Defaults to "Close". */
    closeAriaLabel?: string;
    /** "sunken" tints the header and turns the title navy. */
    tone?: "plain" | "sunken";
}

/** Modal/panel header with optional close control. */
export default function PanelHeader({
    title,
    subtitle,
    titleId,
    rightSlot,
    onClose,
    closeAriaLabel = "Close",
    tone = "plain",
}: PanelHeaderProps) {
    const sunken = tone === "sunken";

    return (
        <div
            style={{
                padding: sunken ? "16px 22px" : "16px 18px",
                borderBottom: `1px solid ${T.BORDER}`,
                display: "flex",
                alignItems: subtitle ? "flex-start" : "center",
                justifyContent: "space-between",
                gap: subtitle ? 12 : 10,
                // Sticky when modal-panel body scrolls so close stays top-right.
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: sunken ? T.SURFACE_2 : T.WHITE,
            }}
        >
            <div style={{ minWidth: 0, flex: 1 }}>
                <div
                    id={titleId}
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: sunken ? T.NAVY : T.TEXT,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: 0,
                    }}
                >
                    {title}
                </div>
                {subtitle ? (
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {subtitle}
                    </div>
                ) : null}
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                    marginLeft: "auto",
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
