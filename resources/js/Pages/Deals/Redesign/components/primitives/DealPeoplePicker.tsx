import { useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import DealAvatar from "./DealAvatar";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { initialsFromName } from "../../adapters/initials";

export interface DealPersonOption {
    id: number;
    name: string;
    designation?: string;
}

interface DealPeoplePickerProps {
    people: DealPersonOption[];
    exclude?: number[];
    onPick: (person: DealPersonOption) => void;
    autoFocus?: boolean;
    placeholder?: string;
    /** Id of the person currently being assigned — shows a spinner on their
     * row (far right) instead of leaving the pick unacknowledged, and blocks
     * further picks until it settles. */
    pendingId?: number | null;
}

/** Ported from v2.2's PeoplePicker (deal-v2-2.jsx:877-905) — search over employees. */
export default function DealPeoplePicker({
    people,
    exclude = [],
    onPick,
    autoFocus,
    placeholder,
    pendingId,
}: DealPeoplePickerProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();

    const results = useMemo(
        () =>
            people
                .filter((person) => !exclude.includes(person.id))
                .filter(
                    (person) =>
                        !q ||
                        person.name.toLowerCase().includes(q) ||
                        (person.designation || "").toLowerCase().includes(q),
                ),
        [people, exclude, q],
    );

    return (
        <div>
            <input
                className="dr-input"
                type="search"
                aria-label={
                    placeholder || t("pages.deals.header.team.search_employees")
                }
                placeholder={
                    placeholder || t("pages.deals.header.team.search_employees")
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus={autoFocus}
                style={{ marginBottom: 6, fontSize: 12, padding: "8px 10px" }}
            />
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {results.length === 0 ? (
                    <div
                        className="px-1.5 py-2 text-xs italic"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {t("pages.deals.header.team.no_employees_match")} "{query}"
                    </div>
                ) : (
                    results.map((person) => {
                        const isPending = person.id === pendingId;
                        return (
                            <button
                                key={person.id}
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
                                onClick={() => onPick(person)}
                            >
                                <DealAvatar
                                    type="agent"
                                    size={24}
                                    initials={initialsFromName(person.name)}
                                />
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "left",
                                    }}
                                >
                                    <span style={{ display: "block", fontSize: 13 }}>
                                        {person.name}
                                    </span>
                                    {person.designation && (
                                        <span
                                            style={{
                                                display: "block",
                                                fontSize: 12,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {person.designation}
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
