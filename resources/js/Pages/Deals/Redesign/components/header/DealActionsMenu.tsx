import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useTranslation from "@/Hooks/useTranslation";
import DealIcon from "../primitives/DealIcon";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";

interface DealActionsMenuProps {
    onAddNote: () => void;
    onAddTask: () => void;
    onScheduleMeeting: () => void;
    onDelete: () => void;
    /** Omitted (not just a no-op) when the product-tour feature flag is off — hides the menu item entirely. */
    onReplayGuide?: () => void;
    canDelete: boolean;
    /** Hide write actions for watcher-only users (backend rejects their writes). */
    canAddNote?: boolean;
    canAddTask?: boolean;
    canScheduleMeeting?: boolean;
    /**
     * Admin-only manual outcome override. Omitted entirely for non-admins rather
     * than shown disabled — the endpoint 403s for them either way.
     */
    onSetOutcome?: (outcome: "won" | "lost" | null) => void;
    currentOutcome?: "won" | "lost" | null;
}

/**
 * Deal "⋯" actions menu, ported from v2.2's ActionsMenu (deal-v2-2.jsx:1354-1407).
 * Lock/Unlock is still omitted (no user-facing backing); Won/Lost is admin-only
 * and routed through onSetOutcome, which confirms before firing because marking
 * a deal won queues commission payouts.
 */
export default function DealActionsMenu({
    onAddNote,
    onAddTask,
    onScheduleMeeting,
    onDelete,
    onReplayGuide,
    canDelete,
    canAddNote = true,
    canAddTask = true,
    canScheduleMeeting = true,
    onSetOutcome,
    currentOutcome = null,
}: DealActionsMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    // Up to 9 entries (3 quick actions + guide + 3 outcome transitions +
    // delete) — the 260px default cut the list off before Delete deal.
    const floatStyle = useFloatingMenuPosition(open, btnRef, {
        align: "right",
        maxHeight: 420,
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

    const run = (action: () => void) => {
        setOpen(false);
        action();
    };

    const items: Array<{ label: string; action: () => void; danger?: boolean }> =
        [
            ...(canAddNote
                ? [
                      {
                          label: t("pages.deals.workspace.notes.add_note"),
                          action: onAddNote,
                      },
                  ]
                : []),
            ...(canAddTask
                ? [
                      {
                          label: t("pages.deals.workspace.tasks.add_task"),
                          action: onAddTask,
                      },
                  ]
                : []),
            ...(canScheduleMeeting
                ? [
                      {
                          label: t("pages.deals.workspace.meetings.schedule"),
                          action: onScheduleMeeting,
                      },
                  ]
                : []),
        ];

    if (onReplayGuide) {
        items.push({
            label: t("pages.deals.tour.replay_menu_item"),
            action: onReplayGuide,
        });
    }

    // Only the transitions that change something are offered, so the menu never
    // shows "Mark as won" on a deal that is already won.
    const outcomeItems: Array<{ label: string; action: () => void }> = [];

    if (onSetOutcome) {
        if (currentOutcome !== "won") {
            outcomeItems.push({
                label: t("pages.deals.header.outcome.mark_won"),
                action: () => onSetOutcome("won"),
            });
        }
        if (currentOutcome !== "lost") {
            outcomeItems.push({
                label: t("pages.deals.header.outcome.mark_lost"),
                action: () => onSetOutcome("lost"),
            });
        }
        if (currentOutcome !== null) {
            outcomeItems.push({
                label: t("pages.deals.header.outcome.clear"),
                action: () => onSetOutcome(null),
            });
        }
    }

    return (
        <div data-tour="deal-actions-menu" style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t("pages.deals.header.actions_aria")}
                onClick={() => setOpen((v) => !v)}
                className="dr-btn dr-btn-sm dr-btn-ghost"
                style={{ padding: "5px 8px" }}
            >
                <DealIcon name="more" size={16} />
            </button>
            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="menu"
                        style={{ ...floatStyle, minWidth: 200 }}
                    >
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                className="dr-menu-item"
                                onClick={() => run(item.action)}
                            >
                                {item.label}
                            </button>
                        ))}
                        {outcomeItems.length > 0 && (
                            <>
                                <div className="dr-menu-sep" role="separator" />
                                {outcomeItems.map((item) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        role="menuitem"
                                        className="dr-menu-item"
                                        onClick={() => run(item.action)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </>
                        )}
                        {canDelete && (
                            <>
                                <div className="dr-menu-sep" role="separator" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="dr-menu-item danger"
                                    onClick={() => run(onDelete)}
                                >
                                    {t("pages.deals.header.delete_deal")}
                                </button>
                            </>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
