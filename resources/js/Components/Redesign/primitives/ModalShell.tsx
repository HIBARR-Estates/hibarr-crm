import {
    useEffect,
    useRef,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
    type RefObject,
} from "react";
import { createPortal } from "react-dom";
import "../redesign.css";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    /** Called on Escape. Return true if the key was handled (don't close). */
    onEscape?: () => boolean;
    /** When true, clicking the dimmed overlay closes the modal. */
    closeOnBackdrop?: boolean;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    /**
     * Overrides the shared overlay z-index (1300, `.redesign-modal-overlay`),
     * e.g. to lift a dialog above another open one or above an antd Modal
     * (1400), or to drop a page-level dialog below other chrome.
     */
    zIndex?: number;
    /** Extra overlay class, e.g. for a page-specific entry animation. */
    overlayClassName?: string;
    panelClassName?: string;
    panelStyle?: CSSProperties;
    /** Exposes the rendered panel's DOM node, e.g. to clamp a child popover within its bounds. */
    panelRef?: RefObject<HTMLDivElement | null>;
    /** "first" focuses the first focusable child on open; "panel" the dialog itself. */
    initialFocus?: "panel" | "first";
    /** Keep Tab / Shift+Tab cycling inside the panel. */
    trapFocus?: boolean;
    children: ReactNode;
}

/**
 * The one overlay + dialog shell for redesign modals. Portals to
 * document.body, locks body scroll, closes on Escape unless `onEscape`
 * reports that a nested popover consumed the key, and restores focus on
 * close. `Modal` layers the standard header/body/footer on top; headerless
 * or fully custom dialogs (task form/detail, deal team) use this directly.
 */
export default function ModalShell({
    open,
    onClose,
    onEscape,
    closeOnBackdrop = false,
    ariaLabel,
    ariaLabelledBy,
    zIndex,
    overlayClassName,
    panelClassName,
    panelStyle,
    panelRef: externalPanelRef,
    initialFocus = "panel",
    trapFocus = false,
    children,
}: ModalShellProps) {
    const internalPanelRef = useRef<HTMLDivElement>(null);
    const panelRef = externalPanelRef ?? internalPanelRef;

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
        const previousFocus = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        // A field inside the panel (e.g. the task title input) may already
        // have claimed focus via its own `autoFocus` during this same commit
        // — don't yank it back in that case.
        if (panel && !panel.contains(document.activeElement)) {
            const first =
                initialFocus === "first"
                    ? panel.querySelector<HTMLElement>(FOCUSABLE)
                    : null;
            (first ?? panel).focus();
        }
        return () => {
            if (previousFocus && document.contains(previousFocus)) {
                previousFocus.focus();
            }
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!trapFocus || event.key !== "Tab") return;
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
            className={
                overlayClassName
                    ? `redesign-modal-overlay ${overlayClassName}`
                    : "redesign-modal-overlay"
            }
            role="presentation"
            style={zIndex !== undefined ? { zIndex } : undefined}
            onClick={() => {
                if (closeOnBackdrop) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handlePanelKeyDown}
                className={panelClassName}
                // The panel can take programmatic focus on open so screen
                // readers land inside the dialog — without this reset the
                // browser's default focus ring outlines the whole panel.
                style={{ ...panelStyle, outline: "none" }}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
