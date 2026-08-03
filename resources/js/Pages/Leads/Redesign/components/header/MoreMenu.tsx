import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/Components/Redesign";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    MORE_MENU_ITEMS,
    type MoreMenuActionId,
} from "../../config/moreMenuItems";

interface MoreMenuProps {
    onAction: (id: MoreMenuActionId) => void;
    canDelete?: boolean;
    canFindDuplicates?: boolean;
    showQualification?: boolean;
}

/**
 * Lead ⋯ actions menu — same portaled floating pattern as DealActionsMenu.
 * Owner reassignment lives on LeadOwnerCard, not here.
 */
export default function MoreMenu({
    onAction,
    canDelete = true,
    canFindDuplicates = false,
    showQualification = true,
}: MoreMenuProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, btnRef, {
        align: "right",
        maxHeight: 420,
    });

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (event: MouseEvent) => {
            const target = event.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const items = MORE_MENU_ITEMS.filter((item) => {
        if (item.id === "delete") return canDelete;
        if (item.id === "find_duplicates") return canFindDuplicates;
        if (item.id === "answers") return showQualification;
        return true;
    });

    const run = (id: MoreMenuActionId) => {
        setOpen(false);
        onAction(id);
    };

    return (
        <div style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={td("More actions")}
                onClick={() => setOpen((value) => !value)}
                className="v2-btn v2-btn-ghost"
                style={{ padding: "5px 8px" }}
            >
                <Icon name="more" size={16} />
            </button>
            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="menu"
                        style={{ ...floatStyle, minWidth: 220 }}
                    >
                        <div className="dr-label" style={{ padding: "4px 8px" }}>
                            {td("Lead actions")}
                        </div>
                        {items.map((item, index) =>
                            item.id === "sep" ? (
                                <div
                                    key={`sep-${index}`}
                                    className="dr-menu-sep"
                                    role="separator"
                                />
                            ) : (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="menuitem"
                                    className={`dr-menu-item${item.danger ? " danger" : ""}`}
                                    onClick={() => run(item.id)}
                                >
                                    {td(item.label)}
                                </button>
                            ),
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
