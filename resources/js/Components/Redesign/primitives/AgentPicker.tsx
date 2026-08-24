import { useState } from "react";
import { useFormData } from "@/Hooks/useFormData";
import { useDebounce } from "@/Hooks/useDebounce";
import Avatar from "./Avatar";
import { REDESIGN_TOKENS as T } from "../tokens";
import { initialsFromName } from "../adapters/initials";

export interface AgentOption {
    id: number;
    name: string;
}

interface LeadAgentRecord {
    id: number;
    name: string;
    user?: {
        id: number;
        name: string;
        email?: string;
        employee_detail?: {
            designation?: { name?: string } | null;
        } | null;
    };
}

interface AgentPickerProps {
    exclude?: number[];
    onPick: (agent: AgentOption) => void;
    autoFocus?: boolean;
    /** Id of the agent currently being assigned — shows a spinner on their row. */
    pendingId?: number | null;
    searchPlaceholder?: string;
    loadingLabel?: string;
    emptyLabel?: string;
    /** Omit agents already flagged as partners (for "add partner" flows). */
    excludePartners?: boolean;
}

/**
 * Remote-search agent picker (paginated `lead-agents` endpoint).
 */
export default function AgentPicker({
    exclude = [],
    onPick,
    autoFocus,
    pendingId,
    searchPlaceholder = "Search agents…",
    loadingLabel = "Loading…",
    emptyLabel = "No agents match",
    excludePartners,
}: AgentPickerProps) {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);

    const { data, loading } = useFormData<LeadAgentRecord>("lead-agents", {
        search: debouncedSearch,
        per_page: 20,
        paginate: false,
        ...(excludePartners ? { exclude_partners: true } : {}),
    });
    const agents = ((data as LeadAgentRecord[] | undefined) ?? []).filter(
        (option) => !exclude.includes(option.id),
    );

    return (
        <div>
            <input
                className="dr-input"
                type="search"
                autoFocus={autoFocus}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                style={{ marginBottom: 6, fontSize: 12, padding: "8px 10px" }}
            />
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {loading ? (
                    <div
                        className="px-1.5 py-2 text-xs italic"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {loadingLabel}
                    </div>
                ) : agents.length === 0 ? (
                    <div
                        className="px-1.5 py-2 text-xs italic"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {emptyLabel}
                    </div>
                ) : (
                    agents.map((option) => {
                        const name = option.user?.name ?? option.name;
                        const designation =
                            option.user?.employee_detail?.designation?.name;
                        const isPending = option.id === pendingId;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                className="dr-menu-item"
                                disabled={pendingId != null}
                                style={{
                                    opacity:
                                        pendingId != null && !isPending
                                            ? 0.5
                                            : 1,
                                    cursor:
                                        pendingId != null
                                            ? "default"
                                            : "pointer",
                                }}
                                onClick={() => onPick({ id: option.id, name })}
                            >
                                <Avatar
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
                                    <span style={{ display: "block", fontSize: 13 }}>
                                        {name}
                                    </span>
                                    {designation && (
                                        <span
                                            style={{
                                                display: "block",
                                                marginTop: 2,
                                                fontSize: 12,
                                                color: T.TEXT_MUTED,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {designation}
                                        </span>
                                    )}
                                </span>
                                {isPending && (
                                    <span
                                        aria-hidden="true"
                                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                                    >
                                        <span
                                            className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                                            style={{ color: T.TEXT_MUTED }}
                                        />
                                    </span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
