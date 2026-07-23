import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DealIcon from "./DealIcon";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

export interface DealMenuOption {
    value: string | number;
    label: string;
}

interface DealMenuSelectProps {
    value: string | number | null | undefined;
    options: DealMenuOption[];
    onChange: (value: string | number) => void;
    placeholder?: string;
    size?: "sm" | "md";
    disabled?: boolean;
    align?: "left" | "right";
    width?: number;
    triggerStyle?: CSSProperties;
    triggerClassName?: string;
}

/**
 * Custom dropdown trigger + portal-rendered menu, replacing a native
 * <select> wherever the trigger needs to stay a fixed compact width.
 * Ported from the v2.2 playground's MenuSelect (deal-v2-2.jsx:609-676).
 */
export default function DealMenuSelect({
    value,
    options,
    onChange,
    placeholder = "Select…",
    size = "md",
    disabled,
    align = "left",
    width,
    triggerStyle,
    triggerClassName,
}: DealMenuSelectProps) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const isDisabled = disabled || options.length === 0;
    const floatStyle = useFloatingMenuPosition(open, btnRef, {
        align,
        maxHeight: 260,
    });

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const current = options.find((o) => String(o.value) === String(value));
    const sm = size === "sm";

    return (
        <div
            style={{ display: "inline-flex", maxWidth: "100%" }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={isDisabled}
                onClick={() => setOpen((v) => !v)}
                className={
                    triggerClassName ?? `dr-btn dr-btn-ghost${sm ? " dr-btn-sm" : ""}`
                }
                style={{
                    maxWidth: width || (sm ? 150 : 190),
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: T.WHITE,
                    color: T.TEXT_MUTED,
                    border: `1px solid ${T.BORDER}`,
                    ...triggerStyle,
                }}
            >
                <span
                    style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {current ? current.label : placeholder}
                </span>
                {!isDisabled && (
                    <DealIcon
                        name={open ? "chevron-up" : "chevron-down"}
                        size={10}
                    />
                )}
            </button>
            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="menu"
                        style={{
                            ...floatStyle,
                            minWidth: 170,
                            maxWidth: 320,
                            overflowY: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {options.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={String(o.value) === String(value)}
                                className="dr-menu-item"
                                onClick={() => {
                                    setOpen(false);
                                    onChange(o.value);
                                }}
                            >
                                <span style={{ flex: 1, textAlign: "left" }}>
                                    {o.label}
                                </span>
                                {String(o.value) === String(value) && (
                                    <DealIcon name="check" size={12} color={T.BLUE} />
                                )}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
