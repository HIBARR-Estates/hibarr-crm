import {
    useEffect,
    useRef,
    type CSSProperties,
    type ReactNode,
    type RefObject,
} from "react";
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
    /** Exposes the rendered panel's DOM node, e.g. to clamp a child popover within its bounds. */
    panelRef?: RefObject<HTMLDivElement | null>;
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
    panelRef: externalPanelRef,
    children,
}: TaskModalShellProps) {
    const internalPanelRef = useRef<HTMLDivElement>(null);
    const panelRef = externalPanelRef ?? internalPanelRef;
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
        // A field inside the panel (e.g. the task title input) may already
        // have claimed focus via its own `autoFocus` during this same commit
        // — don't yank it back to the panel container in that case.
        if (!panelRef.current?.contains(document.activeElement)) {
            panelRef.current?.focus();
        }
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
                // The panel takes programmatic focus on open (below) so
                // screen readers land inside the dialog — but with no
                // `outline` reset that shows the browser's default focus
                // ring (colored by the OS accent color) around the whole
                // panel. The dialog itself isn't an interactive control;
                // its focusable children still get their own focus rings.
                style={{ ...panelStyle, outline: "none" }}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
