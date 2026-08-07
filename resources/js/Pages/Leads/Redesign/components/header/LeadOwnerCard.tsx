import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lead } from "@/Types/api/leads";
import { Icon, initialsFromName } from "@/Components/Redesign";
import AgentPicker from "@/Components/Redesign/primitives/AgentPicker";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealConfirmDialog from "@/Pages/Deals/Redesign/components/primitives/DealConfirmDialog";
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
    const [pending, setPending] = useState<{
        kind: "assign" | "unassign";
        agent: { id: number; name: string } | null;
    } | null>(null);
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

    const requestChange = (agent: { id: number; name: string } | null) => {
        if (agent === null) {
            setPending({ kind: "unassign", agent: null });
            setOpen(false);
            return;
        }
        if (owner?.id === agent.id) {
            setOpen(false);
            return;
        }
        setPending({ kind: "assign", agent });
        setOpen(false);
    };

    const confirmChange = () => {
        if (!pending) return;
        void reassign(pending.agent)
            .then(() => setPending(null))
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
                    {td("Lead owner", { source: "en" })}
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
                    {ownerName ?? td("Assign owner", { source: "en" })}
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

    const confirmTitle =
        pending?.kind === "unassign"
            ? td("Unassign lead owner?", { source: "en" })
            : td("Change lead owner?", { source: "en" });
    const confirmMessage =
        pending?.kind === "unassign"
            ? `${td("Remove", { source: "en" })} ${ownerName ?? td("this owner", { source: "en" })} ${td("as the lead owner?", { source: "en" })}`
            : pending?.agent
              ? ownerName
                  ? `${td("Reassign from", { source: "en" })} ${ownerName} ${td("to", { source: "en" })} ${pending.agent.name}?`
                  : `${td("Assign", { source: "en" })} ${pending.agent.name} ${td("as the lead owner?", { source: "en" })}`
              : "";

    return (
        <div style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={
                    ownerName
                        ? `${td("Lead owner", { source: "en" })}: ${ownerName}`
                        : td("Assign owner", { source: "en" })
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
                        aria-label={td("Assign lead owner", { source: "en" })}
                        style={{ ...floatStyle, minWidth: 270, padding: 10 }}
                    >
                        <div className="dr-label" style={{ marginBottom: 6 }}>
                            {td("Assign lead owner", { source: "en" })}
                        </div>
                        <AgentPicker
                            onPick={(picked) => requestChange(picked)}
                            pendingId={pendingAgentId}
                            autoFocus
                            searchPlaceholder={td("Search agents…", { source: "en" })}
                            loadingLabel={td("Loading…", { source: "en" })}
                            emptyLabel={td("No agents match", { source: "en" })}
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
                                    onClick={() => requestChange(null)}
                                >
                                    {td("Unassign", { source: "en" })} {ownerName}
                                </button>
                            </>
                        ) : null}
                    </div>,
                    document.body,
                )}

            <DealConfirmDialog
                open={pending != null}
                title={confirmTitle}
                message={confirmMessage}
                confirmLabel={
                    pending?.kind === "unassign"
                        ? td("Unassign", { source: "en" })
                        : td("Change owner", { source: "en" })
                }
                confirmLoading={saving}
                onConfirm={confirmChange}
                onCancel={() => setPending(null)}
            />
        </div>
    );
}
