import { KeyboardEvent, MouseEvent, ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { REDESIGN_TOKENS as T } from "../tokens";

interface ConfirmDialogProps {
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

/** Confirm/alert dialog for destructive or skip actions. */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger,
    confirmLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const allowBackdropCloseRef = useRef(false);

    useEffect(() => {
        if (!open) {
            allowBackdropCloseRef.current = false;
            return undefined;
        }
        allowBackdropCloseRef.current = false;
        const frame = window.requestAnimationFrame(() => {
            allowBackdropCloseRef.current = true;
        });
        return () => window.cancelAnimationFrame(frame);
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape" && !confirmLoading) onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel, confirmLoading]);

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

    const handleBackdropMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (confirmLoading || !allowBackdropCloseRef.current) return;
        onCancel();
    };

    const handleConfirm = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirmLoading) return;
        onConfirm();
    };

    return createPortal(
        <div
            className="redesign-modal-overlay"
            onMouseDown={handleBackdropMouseDown}
            role="presentation"
        >
            <div
                className="modal-panel"
                style={{ maxWidth: 400 }}
                ref={dialogRef}
                onKeyDown={trapTab}
                onMouseDown={(e) => e.stopPropagation()}
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
                        className="dr-btn dr-btn-ghost"
                        onClick={onCancel}
                        disabled={confirmLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="dr-btn"
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
                        onClick={handleConfirm}
                    >
                        {confirmLoading && (
                            <span
                                aria-hidden="true"
                                className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
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
