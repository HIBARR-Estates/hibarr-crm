import { ReactNode, useId } from "react";
import ModalShell from "./ModalShell";
import PanelHeader from "./PanelHeader";
import { REDESIGN_TOKENS as T } from "../tokens";

interface ModalProps {
    open: boolean;
    title: string;
    /** Second header line — what this dialog is acting on. */
    subtitle?: ReactNode;
    /** "sunken" tints the header, matching the mapping dialogs. */
    headerTone?: "plain" | "sunken";
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    /**
     * Set while the form holds unsaved edits. Blocks the *accidental* dismissal
     * paths (backdrop click, Escape) so a stray click can't discard work. The
     * deliberate paths — header X and footer Cancel — still close.
     */
    dirty?: boolean;
    closeAriaLabel?: string;
    /** Overrides the default 520px max-width, e.g. for modals with a rich text editor. */
    maxWidth?: number;
    /**
     * Clicking the backdrop closes the dialog. Off by default — a stray
     * click outside a form (schedule/edit) shouldn't discard what was being
     * entered. A read-only "show" dialog has nothing to lose, so those
     * callers opt in.
     */
    closeOnBackdrop?: boolean;
    /**
     * Lifts this dialog above another that is already open. The CSS default
     * (1300) sits below an antd Modal, which this app renders at 1400
     * (zIndexPopupBase is raised to 1300 in providers/antd/utils.ts, plus
     * antd's own +100 container offset), so a dialog opened from inside one
     * must say so explicitly or it renders underneath.
     */
    zIndex?: number;
}

export function Modal({
    open,
    title,
    subtitle,
    headerTone = "plain",
    onClose,
    children,
    footer,
    dirty = false,
    closeAriaLabel,
    maxWidth,
    zIndex,
    closeOnBackdrop = false,
}: ModalProps) {
    const titleId = useId();

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            onEscape={() => dirty}
            closeOnBackdrop={closeOnBackdrop && !dirty}
            ariaLabelledBy={titleId}
            zIndex={zIndex}
            panelClassName="modal-panel"
            panelStyle={
                maxWidth ? { maxWidth: `min(${maxWidth}px, 100%)` } : undefined
            }
            initialFocus="first"
            trapFocus
        >
            <PanelHeader
                title={title}
                subtitle={subtitle}
                tone={headerTone}
                titleId={titleId}
                onClose={onClose}
                closeAriaLabel={closeAriaLabel}
            />
            <div style={{ padding: "20px 22px", minWidth: 0, overflowWrap: "anywhere" }}>
                {children}
            </div>
            {footer && (
                <div
                    style={{
                        padding: "14px 22px",
                        borderTop: `1px solid ${T.BORDER}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 8,
                    }}
                >
                    {footer}
                </div>
            )}
        </ModalShell>
    );
}

interface ModalFieldProps {
    label: ReactNode;
    children: ReactNode;
}

export function ModalField({ label, children }: ModalFieldProps) {
    return (
        <div className="modal-field" style={{ marginBottom: 16 }}>
            <label>{label}</label>
            {children}
        </div>
    );
}
