import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useTranslation from "@/Hooks/useTranslation";
import DealAvatar from "../primitives/DealAvatar";
import DealAgentPicker from "../primitives/DealAgentPicker";
import DealIcon from "../primitives/DealIcon";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";
import useDealTeamMutations from "../../hooks/useDealTeamMutations";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface AgentInfo {
    id: number;
    name?: string;
    initials: string;
}

interface DealAgentCardProps {
    dealId: number;
    agent: AgentInfo | null;
    canEdit: boolean;
}

/** Ported from v2.2's AgentCard + PeoplePicker (deal-v2-2.jsx:877-1017). */
export default function DealAgentCard({
    dealId,
    agent,
    canEdit,
}: DealAgentCardProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, btnRef, { align: "right", maxHeight: 360 });
    const { saveTeamField, isSaving } = useDealTeamMutations(dealId);
    const isAssigning = isSaving("agent_id");

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

    const [pendingPickId, setPendingPickId] = useState<number | null>(null);

    const pick = (agentId: number | null) => {
        if (agentId === null) {
            // Unassign has no picker row to show a spinner on — close as before.
            saveTeamField("agent_id", null);
            setOpen(false);
            return;
        }
        // Keep the menu open (with a spinner on the picked row) until the
        // assignment settles, instead of closing instantly on click.
        setPendingPickId(agentId);
        saveTeamField("agent_id", agentId)
            .then(() => setOpen(false))
            .finally(() => setPendingPickId(null));
    };

    const exclude = agent ? [agent.id] : [];

    const chip = (
        <>
            {agent ? (
                <DealAvatar type="agent" size={34} initials={agent.initials} />
            ) : (
                <span
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: T.BG,
                        border: `1px dashed ${T.BORDER}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: T.TEXT_MUTED,
                        flexShrink: 0,
                    }}
                >
                    <DealIcon name="users" size={15} />
                </span>
            )}
            <span style={{ minWidth: 0, maxWidth: 160 }}>
                <span className="dr-label" style={{ display: "block", fontSize: 12 }}>
                    {t("pages.deals.header.team.agent_label")}
                </span>
                <span
                    style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: agent ? T.TEXT : T.BLUE,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {agent ? agent.name : t("pages.deals.header.team.assign_agent")}
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
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
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
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={
                    agent
                        ? `${t("pages.deals.header.team.agent_label")}: ${agent.name}`
                        : t("pages.deals.header.team.assign_agent_aria")
                }
                onClick={() => setOpen((v) => !v)}
                disabled={isAssigning}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 10,
                    padding: "8px 12px",
                    cursor: isAssigning ? "default" : "pointer",
                    opacity: isAssigning ? 0.6 : 1,
                    fontFamily: "inherit",
                    textAlign: "left",
                }}
            >
                {chip}
                <span style={{ color: T.TEXT_MUTED, display: "flex", marginLeft: 2 }}>
                    {isAssigning ? (
                        <span
                            aria-hidden="true"
                            className="flex h-3.5 w-3.5 items-center justify-center"
                        >
                            <span className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent h-3 w-3" />
                        </span>
                    ) : (
                        <DealIcon name={open ? "chevron-up" : "chevron-down"} size={14} />
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
                        aria-label={t("pages.deals.header.team.assign_deal_agent")}
                        style={{ ...floatStyle, minWidth: 270, padding: 10 }}
                    >
                        <div className="dr-label" style={{ marginBottom: 6 }}>
                            {t("pages.deals.header.team.assign_deal_agent")}
                        </div>
                        <DealAgentPicker
                            exclude={exclude}
                            onPick={(picked) => pick(picked.id)}
                            pendingId={pendingPickId}
                            autoFocus
                        />
                        {agent && (
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
                                    {t("pages.deals.header.team.unassign")} {agent.name}
                                </button>
                            </>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
