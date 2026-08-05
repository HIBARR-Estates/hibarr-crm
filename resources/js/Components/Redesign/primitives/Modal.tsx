import {
    KeyboardEvent as ReactKeyboardEvent,
    ReactNode,
    useEffect,
    useId,
    useRef,
} from "react";
import { createPortal } from "react-dom";
import PanelHeader from "./PanelHeader";
import { REDESIGN_TOKENS as T } from "../tokens";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
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
    closeAriaLabel?: string;
}

export function Modal({
    open,
    title,
    onClose,
    children,
    footer,
    dirty = false,
    closeAriaLabel,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !dirty) onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose, dirty]);

    useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panelRef.current)?.focus();
        return () => previouslyFocused?.focus?.();
    }, [open]);

    if (!open || typeof document === "undefined") return null;

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
                <PanelHeader
                    title={title}
                    titleId={titleId}
                    onClose={onClose}
                    closeAriaLabel={closeAriaLabel}
                />
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

interface ModalFieldProps {
    label: string;
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
