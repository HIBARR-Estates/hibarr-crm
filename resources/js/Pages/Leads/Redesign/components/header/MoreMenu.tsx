import { useEffect, useRef, useState } from "react";
import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    MORE_MENU_ITEMS,
    type MoreMenuActionId,
} from "../../config/moreMenuItems";

interface MoreMenuProps {
    onAction: (id: MoreMenuActionId) => void;
    canDelete?: boolean;
}

export default function MoreMenu({
    onAction,
    canDelete = true,
}: MoreMenuProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const items = MORE_MENU_ITEMS.filter(
        (item) => item.id !== "delete" || canDelete,
    );

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                type="button"
                aria-label={td("More actions")}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                style={{
                    background: "var(--lr-surface)",
                    border: "1px solid var(--lr-border)",
                    borderRadius: 8,
                    color: "var(--lr-text-muted)",
                    cursor: "pointer",
                    padding: "7px 9px",
                    display: "inline-flex",
                    alignItems: "center",
                }}
            >
                <Icon name="more" size={16} />
            </button>
            {open && (
                <div className="v2-menu">
                    <div className="v2-menu-label">{td("Lead actions")}</div>
                    {items.map((item, index) =>
                        item.id === "sep" ? (
                            <div
                                key={`sep-${index}`}
                                className="v2-menu-sep"
                            />
                        ) : (
                            <button
                                key={item.id}
                                type="button"
                                className={`v2-menu-item${item.danger ? " danger" : ""}`}
                                onClick={() => {
                                    setOpen(false);
                                    onAction(item.id);
                                }}
                            >
                                {td(item.label)}
                            </button>
                        ),
                    )}
                </div>
            )}
        </div>
    );
}
