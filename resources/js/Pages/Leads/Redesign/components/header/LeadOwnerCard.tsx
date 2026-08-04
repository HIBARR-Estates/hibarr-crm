import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lead } from "@/Types/api/leads";
import { Icon, initialsFromName } from "@/Components/Redesign";
import AgentPicker from "@/Components/Redesign/primitives/AgentPicker";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useLeadOwnerReassign from "../../hooks/useLeadOwnerReassign";

interface LeadOwnerCardProps {
    lead: Lead;
    canEdit?: boolean;
}

/**
 * Inline lead-owner chip — same pattern as DealAgentCard: click opens a
 * portaled AgentPicker popover; pick patches local workspace state.
 */
export default function LeadOwnerCard({
    lead,
    canEdit = true,
}: LeadOwnerCardProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, btnRef, {
        align: "right",
        maxHeight: 360,
    });
    const { reassign, pendingAgentId, saving } = useLeadOwnerReassign();

    const owner = lead.lead_owner ?? null;
    const ownerName = owner?.name ?? null;
    const ownerInitials = initialsFromName(ownerName);

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

    const pick = (agent: { id: number; name: string } | null) => {
        if (agent === null) {
            void reassign(null).then(() => setOpen(false));
            return;
        }
        void reassign(agent)
            .then(() => setOpen(false))
            .catch(() => {
                /* toast already shown by updateField */
            });
    };

    const chip = (
        <>
            {owner ? (
                <span
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--lr-navy)",
                        color: "var(--lr-white)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                >
                    {ownerInitials}
                </span>
            ) : (
                <span
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--lr-bg)",
                        border: "1px dashed var(--lr-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--lr-text-muted)",
                        flexShrink: 0,
                    }}
                >
                    <Icon name="users" size={15} />
                </span>
            )}
            <span style={{ minWidth: 0 }}>
                <span
                    style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--lr-text-dim)",
                    }}
                >
                    {td("Lead owner")}
                </span>
                <span
                    style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: owner ? "var(--lr-text)" : "var(--lr-blue)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {ownerName ?? td("Assign owner")}
                </span>
            </span>
        </>
    );

    if (!canEdit) {
        return (
            <div
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--lr-surface)",
                    border: "1px solid var(--lr-border)",
                    borderRadius: 10,
                    padding: "8px 12px",
                }}
            >
                {chip}
            </div>
        );
    }

    return (
        <div style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={
                    ownerName
                        ? `${td("Lead owner")}: ${ownerName}`
                        : td("Assign owner")
                }
                onClick={() => setOpen((value) => !value)}
                disabled={saving}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--lr-surface)",
                    border: "1px solid var(--lr-border)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    cursor: saving ? "default" : "pointer",
                    opacity: saving ? 0.6 : 1,
                    fontFamily: "inherit",
                    textAlign: "left",
                }}
            >
                {chip}
                <span
                    style={{
                        color: "var(--lr-text-muted)",
                        display: "flex",
                        marginLeft: 2,
                    }}
                >
                    {saving ? (
                        <span
                            aria-hidden="true"
                            className="flex h-3.5 w-3.5 items-center justify-center"
                        >
                            <span className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent h-3 w-3" />
                        </span>
                    ) : (
                        <Icon
                            name={open ? "chevron-up" : "chevron-down"}
                            size={14}
                        />
                    )}
                </span>
            </button>

            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="dialog"
                        aria-label={td("Assign lead owner")}
                        style={{ ...floatStyle, minWidth: 270, padding: 10 }}
                    >
                        <div className="dr-label" style={{ marginBottom: 6 }}>
                            {td("Assign lead owner")}
                        </div>
                        <AgentPicker
                            onPick={(picked) => pick(picked)}
                            pendingId={pendingAgentId}
                            autoFocus
                            searchPlaceholder={td("Search agents…")}
                            loadingLabel={td("Loading…")}
                            emptyLabel={td("No agents match")}
                        />
                        {owner ? (
                            <>
                                <div
                                    className="dr-menu-sep"
                                    role="separator"
                                    style={{ margin: "8px 0" }}
                                />
                                <button
                                    type="button"
                                    className="dr-menu-item danger"
                                    onClick={() => pick(null)}
                                >
                                    {td("Unassign")} {ownerName}
                                </button>
                            </>
                        ) : null}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
