import { type ReactNode, useId } from "react";
import ModalShell from "./ModalShell";
import PanelHeader from "./PanelHeader";
import { REDESIGN_TOKENS as T } from "../tokens";

interface DrawerProps {
    open: boolean;
    title: string;
    subtitle?: ReactNode;
    onClose: () => void;
    children: ReactNode;
    /** Pinned to the bottom of the drawer (actions). */
    footer?: ReactNode;
    /** Set while the form holds unsaved edits: Escape and the backdrop no longer close it. */
    dirty?: boolean;
    closeAriaLabel?: string;
    /** Panel width in px, capped to the viewport. Default 720. */
    width?: number;
    zIndex?: number;
}

/**
 * A panel that slides in from the right edge. Built on {@link ModalShell}, so it
 * shares the one redesign overlay (z-index, scroll lock, Escape, focus restore).
 * Header and footer stay put; only the body scrolls.
 */
export default function Drawer({
    open,
    title,
    subtitle,
    onClose,
    children,
    footer,
    dirty = false,
    closeAriaLabel,
    width = 720,
    zIndex,
}: DrawerProps) {
    const titleId = useId();

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            onEscape={() => dirty}
            closeOnBackdrop={!dirty}
            ariaLabelledBy={titleId}
            zIndex={zIndex}
            overlayClassName="dr-drawer-overlay"
            panelClassName="dr-drawer-panel"
            panelStyle={{ maxWidth: `min(${width}px, 100%)` }}
            initialFocus="first"
            trapFocus
        >
            <PanelHeader
                title={title}
                subtitle={subtitle}
                titleId={titleId}
                onClose={onClose}
                closeAriaLabel={closeAriaLabel}
            />
            <div className="dr-drawer-body">{children}</div>
            {footer && (
                <div
                    style={{
                        padding: "14px 22px",
                        flexShrink: 0,
                        borderTop: `1px solid ${T.BORDER}`,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                        background: T.WHITE,
                    }}
                >
                    {footer}
                </div>
            )}
        </ModalShell>
    );
}
