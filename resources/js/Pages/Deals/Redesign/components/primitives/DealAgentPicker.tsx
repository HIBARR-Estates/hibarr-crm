import { useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useFormData } from "@/Hooks/useFormData";
import { useDebounce } from "@/Hooks/useDebounce";
import DealAvatar from "./DealAvatar";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { initialsFromName } from "../../adapters/initials";

export interface DealAgentOption {
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

interface DealAgentPickerProps {
    exclude?: number[];
    onPick: (agent: DealAgentOption) => void;
    autoFocus?: boolean;
    /** Id of the agent currently being assigned — shows a spinner on their
     * row (far right) instead of leaving the pick unacknowledged, and blocks
     * further picks until it settles. */
    pendingId?: number | null;
}

/**
 * Remote-search agent picker (paginated `lead-agents` endpoint) rendered in
 * the same look as DealPeoplePicker's local list. Ported from v2.2's
 * PeoplePicker (deal-v2-2.jsx:877-905); extracted so DealAgentCard's header
 * picker and the Team modal's agent picker share one implementation.
 */
export default function DealAgentPicker({
    exclude = [],
    onPick,
    autoFocus,
    pendingId,
}: DealAgentPickerProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);

    const { data, loading } = useFormData<LeadAgentRecord>("lead-agents", {
        search: debouncedSearch,
        per_page: 20,
        paginate: false,
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
                placeholder={t("pages.deals.header.team.search_agents")}
                aria-label={t("pages.deals.header.team.search_agents")}
                style={{ marginBottom: 6, fontSize: 12, padding: "8px 10px" }}
            />
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {loading ? (
                    <div
                        className="px-1.5 py-2 text-xs italic"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {t("pages.deals.common.loading")}
                    </div>
                ) : agents.length === 0 ? (
                    <div
                        className="px-1.5 py-2 text-xs italic"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {t("pages.deals.header.team.no_agents_match")}
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
                                            className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
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
