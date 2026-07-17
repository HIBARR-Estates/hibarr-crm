import { KeyboardEvent, ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealConfirmDialogProps {
    open: boolean;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    /** Shows a spinner and disables both buttons while the confirmed action is in flight. */
    confirmLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Ported from v2.2's ConfirmDialog (deal-v2-2.jsx:712-744) — used for
 * non-adjacent pipeline stage jumps and other destructive/skip actions.
 */
export default function DealConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger,
    confirmLoading = false,
    onConfirm,
    onCancel,
}: DealConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open || typeof document === "undefined") return null;

    const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;
        const focusable = dialogRef.current?.querySelectorAll("button");
        if (!focusable || !focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            (last as HTMLElement).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            (first as HTMLElement).focus();
        }
    };

    return createPortal(
        <div className="redesign-modal-overlay" onClick={onCancel} role="presentation">
            <div
                className="modal-panel"
                style={{ maxWidth: 400 }}
                ref={dialogRef}
                onKeyDown={trapTab}
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
            >
                <div style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                        {title}
                    </div>
                    <div style={{ fontSize: 13, color: T.TEXT_MUTED, lineHeight: 1.5 }}>
                        {message}
                    </div>
                </div>
                <div
                    style={{
                        padding: "12px 18px",
                        borderTop: `1px solid ${T.BORDER}`,
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                    }}
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.WHITE, color: T.TEXT_MUTED, border: `1px solid ${T.BORDER}` }}
                        onClick={onCancel}
                        disabled={confirmLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        autoFocus
                        style={{
                            background: danger ? T.RED : T.BLUE,
                            color: T.WHITE,
                            opacity: confirmLoading ? 0.7 : 1,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                        disabled={confirmLoading}
                        onClick={onConfirm}
                    >
                        {confirmLoading && (
                            <span
                                aria-hidden="true"
                                className="animate-spin rounded-full border-2 border-current border-t-transparent"
                                style={{ width: 11, height: 11 }}
                            />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
