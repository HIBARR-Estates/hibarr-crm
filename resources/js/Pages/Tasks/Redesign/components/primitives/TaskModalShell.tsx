import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TaskModalShellProps {
    open: boolean;
    onClose: () => void;
    /** Called on Escape. Return true if the key was handled (don't close). */
    onEscape?: () => boolean;
    /** When true, clicking the dimmed overlay closes the modal. */
    closeOnBackdrop?: boolean;
    ariaLabel: string;
    zIndex?: number;
    panelClassName?: string;
    panelStyle?: CSSProperties;
    children: ReactNode;
}

/**
 * Shared overlay + dialog shell for the task form and detail modals.
 * Locks body scroll, portals to document.body, and closes on Escape unless
 * `onEscape` reports that a nested popover consumed the key.
 */
export default function TaskModalShell({
    open,
    onClose,
    onEscape,
    closeOnBackdrop = false,
    ariaLabel,
    zIndex = 50,
    panelClassName,
    panelStyle,
    children,
}: TaskModalShellProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (onEscape?.()) return;
            onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, onEscape]);

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
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        return () => {
            const previous = previousFocusRef.current;
            if (previous && document.contains(previous)) {
                previous.focus();
            }
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="redesign-modal-overlay tasks-modal-overlay"
            role="presentation"
            onClick={() => {
                if (closeOnBackdrop) onClose();
            }}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(22,41,77,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex,
                padding: 24,
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-label={ariaLabel}
                onClick={(event) => event.stopPropagation()}
                className={panelClassName}
                style={panelStyle}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
