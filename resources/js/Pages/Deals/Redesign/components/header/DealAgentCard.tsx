import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useFormData } from "@/Hooks/useFormData";
import { useDebounce } from "@/Hooks/useDebounce";
import DealAvatar from "../primitives/DealAvatar";
import DealIcon from "../primitives/DealIcon";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";
import useDealTeamMutations from "../../hooks/useDealTeamMutations";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface AgentInfo {
    id: number;
    name?: string;
    initials: string;
}

interface LeadAgentOption {
    id: number;
    name: string;
    user?: { id: number; name: string; email?: string };
}

interface DealAgentCardProps {
    dealId: number;
    agent: AgentInfo | null;
    canEdit: boolean;
    onManageTeam: () => void;
}

function initialsFromName(name?: string | null): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/** Ported from v2.2's AgentCard + PeoplePicker (deal-v2-2.jsx:877-1017). */
export default function DealAgentCard({
    dealId,
    agent,
    canEdit,
    onManageTeam,
}: DealAgentCardProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, btnRef, { align: "right" });
    const { saveTeamField } = useDealTeamMutations(dealId);

    const { data, loading } = useFormData<LeadAgentOption>("lead-agents", {
        search: debouncedSearch,
        per_page: 20,
        paginate: false,
        enabled: open && canEdit,
    });
    const agents: LeadAgentOption[] = (data as LeadAgentOption[] | undefined) ?? [];

    useEffect(() => {
        if (!open) {
            setSearch("");
            return undefined;
        }
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

    const pick = (agentId: number | null) => {
        saveTeamField("agent_id", agentId);
        setOpen(false);
    };

    return (
        <div style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={
                    agent
                        ? `${td("Deal agent")}: ${agent.name}`
                        : td("Assign a deal agent")
                }
                onClick={() => setOpen((v) => !v)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 10,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                }}
            >
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
                <span>
                    <span className="dr-label" style={{ display: "block", fontSize: 11 }}>
                        {td("Deal agent")}
                    </span>
                    <span
                        style={{
                            display: "block",
                            fontSize: 13,
                            fontWeight: 600,
                            color: agent ? T.TEXT : T.BLUE,
                        }}
                    >
                        {agent ? agent.name : td("Assign agent")}
                    </span>
                </span>
                <span style={{ color: T.TEXT_MUTED, display: "flex", marginLeft: 2 }}>
                    <DealIcon name={open ? "chevron-up" : "chevron-down"} size={14} />
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
                        aria-label={td("Assign deal agent")}
                        style={{ ...floatStyle, minWidth: 270, padding: 10 }}
                    >
                        {canEdit && (
                            <>
                                <div className="dr-label" style={{ marginBottom: 6 }}>
                                    {td("Assign deal agent")}
                                </div>
                                <input
                                    className="dr-input"
                                    type="search"
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={td("Search agents…")}
                                    aria-label={td("Search agents")}
                                    style={{
                                        marginBottom: 6,
                                        fontSize: 12,
                                        padding: "8px 10px",
                                    }}
                                />
                                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                    {loading ? (
                                        <div
                                            className="px-1.5 py-2 text-xs italic"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {td("Loading…")}
                                        </div>
                                    ) : agents.length === 0 ? (
                                        <div
                                            className="px-1.5 py-2 text-xs italic"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {td("No agents match")}
                                        </div>
                                    ) : (
                                        agents
                                            .filter((option) => option.id !== agent?.id)
                                            .map((option) => {
                                                const name =
                                                    option.user?.name ?? option.name;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        className="dr-menu-item"
                                                        onClick={() => pick(option.id)}
                                                    >
                                                        <DealAvatar
                                                            type="agent"
                                                            size={24}
                                                            initials={initialsFromName(name)}
                                                        />
                                                        <span
                                                            style={{
                                                                flex: 1,
                                                                minWidth: 0,
                                                                textAlign: "left",
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    display: "block",
                                                                    fontSize: 13,
                                                                }}
                                                            >
                                                                {name}
                                                            </span>
                                                            {option.user?.email && (
                                                                <span
                                                                    style={{
                                                                        display: "block",
                                                                        fontSize: 11,
                                                                        color: T.TEXT_MUTED,
                                                                        overflow: "hidden",
                                                                        textOverflow:
                                                                            "ellipsis",
                                                                        whiteSpace:
                                                                            "nowrap",
                                                                    }}
                                                                >
                                                                    {option.user.email}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                    )}
                                </div>
                                <div
                                    className="dr-menu-sep"
                                    role="separator"
                                    style={{ margin: "8px 0" }}
                                />
                                {agent && (
                                    <button
                                        type="button"
                                        className="dr-menu-item danger"
                                        onClick={() => pick(null)}
                                    >
                                        {td("Unassign")} {agent.name}
                                    </button>
                                )}
                            </>
                        )}
                        <button
                            type="button"
                            className="dr-menu-item"
                            onClick={() => {
                                setOpen(false);
                                onManageTeam();
                            }}
                        >
                            {td("Manage team…")}
                        </button>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
