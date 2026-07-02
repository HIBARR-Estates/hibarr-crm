import { ReactNode } from "react";
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
    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
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
        </div>
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
