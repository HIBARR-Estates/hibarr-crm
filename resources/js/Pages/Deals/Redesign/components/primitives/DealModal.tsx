import {
    KeyboardEvent as ReactKeyboardEvent,
    ReactNode,
    useEffect,
    useId,
    useRef,
} from "react";
import { createPortal } from "react-dom";
import DealPanelHeader from "./DealPanelHeader";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DealModalProps {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    /**
     * Set while the form holds unsaved edits. Blocks the *accidental* dismissal
     * paths (backdrop click, Escape) so a stray click can't discard work. The
     * deliberate paths — header X and footer Cancel — still close.
     */
    dirty?: boolean;
}

export function DealModal({
    open,
    title,
    onClose,
    children,
    footer,
    dirty = false,
}: DealModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    // v2.2's Modal binds Escape-to-close (deal-v2-2.jsx:747-752); this one
    // didn't, unlike DealConfirmDialog which already does.
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !dirty) onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose, dirty]);

    // Lock background scroll so the page behind doesn't move under the modal.
    useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    // Move focus into the dialog on open and restore it to the trigger on close,
    // so keyboard and screen-reader users aren't dropped back at the page top.
    useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panelRef.current)?.focus();
        return () => previouslyFocused?.focus?.();
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    // Keep Tab inside the dialog (matches DealConfirmDialog's trap).
    const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Tab") return;
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return createPortal(
        <div
            className="modal-overlay redesign-modal-overlay"
            onClick={dirty ? undefined : onClose}
            role="presentation"
        >
            <div
                ref={panelRef}
                className="modal-panel"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={trapTab}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <DealPanelHeader title={title} titleId={titleId} onClose={onClose} />
                <div style={{ padding: "20px 22px" }}>{children}</div>
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
            </div>
        </div>,
        document.body,
    );
}

interface DealModalFieldProps {
    label: string;
    children: ReactNode;
}

export function DealModalField({ label, children }: DealModalFieldProps) {
    return (
        <div className="modal-field" style={{ marginBottom: 16 }}>
            <label>{label}</label>
            {children}
        </div>
    );
}
