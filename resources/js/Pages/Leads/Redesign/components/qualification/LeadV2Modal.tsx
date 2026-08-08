import {
    type KeyboardEvent as ReactKeyboardEvent,
    type CSSProperties,
    type ReactNode,
    useEffect,
    useId,
    useRef,
} from "react";
import { createPortal } from "react-dom";
import Icon from "@/Components/Redesign/primitives/Icon";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface LeadV2ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    /** Accessible name when no visible title id is provided. */
    ariaLabel?: string;
    labelledBy?: string;
    maxWidth?: number | string;
    panelStyle?: CSSProperties;
    /** Blocks backdrop / Escape dismissal while dirty. */
    dirty?: boolean;
}

/**
 * Portal modal that keeps the `.lead-redesign` scope so v2-* styles apply
 * (shared Redesign Modal portals outside that scope).
 */
export default function LeadV2Modal({
    open,
    onClose,
    children,
    ariaLabel,
    labelledBy,
    maxWidth = 520,
    panelStyle,
    dirty = false,
}: LeadV2ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const fallbackTitleId = useId();

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
            className="lead-redesign v2-overlay"
            onClick={dirty ? undefined : onClose}
            role="presentation"
        >
            <div
                ref={panelRef}
                className="v2-modal"
                style={{ maxWidth, ...panelStyle }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={trapTab}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={labelledBy ?? fallbackTitleId}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

interface LeadV2ModalHeaderProps {
    title: string;
    titleId?: string;
    subtitle?: ReactNode;
    rightSlot?: ReactNode;
    onClose: () => void;
}

export function LeadV2ModalHeader({
    title,
    titleId,
    subtitle,
    rightSlot,
    onClose,
}: LeadV2ModalHeaderProps) {
    return (
        <div className="v2-modal-header">
            <div style={{ minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                    }}
                >
                    <h2 id={titleId} className="v2-modal-title">
                        {title}
                    </h2>
                    {rightSlot}
                </div>
                {subtitle ? (
                    <p className="v2-modal-subtitle">{subtitle}</p>
                ) : null}
            </div>
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="v2-modal-close"
            >
                <Icon name="x" size={18} />
            </button>
        </div>
    );
}

interface LeadV2ModalFooterProps {
    children: ReactNode;
    style?: CSSProperties;
}

export function LeadV2ModalFooter({ children, style }: LeadV2ModalFooterProps) {
    return (
        <div className="v2-modal-footer" style={style}>
            {children}
        </div>
    );
}
