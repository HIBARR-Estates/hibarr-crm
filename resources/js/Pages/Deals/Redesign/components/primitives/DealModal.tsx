import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import DealPanelHeader from "./DealPanelHeader";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealModalProps {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

export function DealModal({
    open,
    title,
    onClose,
    children,
    footer,
}: DealModalProps) {
    // v2.2's Modal binds Escape-to-close (deal-v2-2.jsx:747-752); this one
    // didn't, unlike DealConfirmDialog which already does.
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div className="modal-overlay redesign-modal-overlay" onClick={onClose}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <DealPanelHeader title={title} onClose={onClose} />
                <div style={{ padding: "16px 18px" }}>{children}</div>
                {footer && (
                    <div
                        style={{
                            padding: "12px 18px",
                            borderTop: `1px solid ${T.BORDER}`,
                            display: "flex",
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
        <div className="modal-field" style={{ marginBottom: 12 }}>
            <label>{label}</label>
            {children}
        </div>
    );
}
