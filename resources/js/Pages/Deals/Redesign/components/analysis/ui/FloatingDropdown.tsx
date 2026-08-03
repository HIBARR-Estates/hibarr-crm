import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface FloatingDropdownProps {
    anchorRef: React.RefObject<HTMLElement | null>;
    open: boolean;
    children: React.ReactNode;
    minWidth?: number;
}

export default function FloatingDropdown({ anchorRef, open, children, minWidth }: FloatingDropdownProps) {
    const [style, setStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (!open) return;
        const update = () => {
            const el = anchorRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            setStyle({
                position: "fixed",
                top: rect.bottom + 4,
                left: rect.left,
                minWidth: Math.max(minWidth ?? 0, rect.width),
                zIndex: 9999,
            });
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open, anchorRef, minWidth]);

    if (!open) return null;
    return createPortal(<div style={style}>{children}</div>, document.body);
}
