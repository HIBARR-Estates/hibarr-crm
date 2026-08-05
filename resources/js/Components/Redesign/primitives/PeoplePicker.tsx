import { useEffect, useMemo, useState } from "react";
import Avatar from "./Avatar";
import { REDESIGN_TOKENS as T } from "../tokens";
import { initialsFromName } from "../adapters/initials";

export interface PersonOption {
    id: number;
    name: string;
    designation?: string;
}

interface PeoplePickerProps {
    people: PersonOption[];
    exclude?: number[];
    onPick: (person: PersonOption) => void;
    autoFocus?: boolean;
    placeholder?: string;
    emptyLabel?: string;
    /** Override empty state; receives the current query string. */
    getEmptyLabel?: (query: string) => string;
    /** Id of the person currently being assigned — shows a spinner on their row. */
    pendingId?: number | null;
    loading?: boolean;
    /**
     * When true, client-side filtering is skipped — parent filters via API.
     * Query is still reported through onQueryChange.
     */
    remoteFilter?: boolean;
    /** Fired whenever the search box changes (for remote-directory fetches). */
    onQueryChange?: (query: string) => void;
}

/** Local-list or remote-backed people picker with search. */
export default function PeoplePicker({
    people,
    exclude = [],
    onPick,
    autoFocus,
    placeholder = "Search employees…",
    emptyLabel,
    getEmptyLabel,
    pendingId,
    loading = false,
    remoteFilter = false,
    onQueryChange,
}: PeoplePickerProps) {
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();

    useEffect(() => {
        onQueryChange?.(query);
    }, [query, onQueryChange]);

    const results = useMemo(() => {
        const available = people.filter(
            (person) => !exclude.includes(person.id),
        );
        if (remoteFilter || !q) return available;
        return available.filter(
            (person) =>
                person.name.toLowerCase().includes(q) ||
                (person.designation || "").toLowerCase().includes(q),
        );
    }, [people, exclude, q, remoteFilter]);

    const defaultEmpty = () => {
        if (loading) return "Loading employees…";
        if (people.length === 0) return "No employees available to assign";
        if (!q) return "No employees left to add";
        return `No employees match "${query}"`;
    };

    return (
        <div>
            <input
                className="dr-input"
                type="search"
                aria-label={placeholder}
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus={autoFocus}
                disabled={loading && people.length === 0}
                style={{ marginBottom: 6, fontSize: 12, padding: "8px 10px" }}
            />
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {results.length === 0 ? (
                    <div
                        className="px-1.5 py-2 text-xs italic"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {getEmptyLabel?.(query) ?? emptyLabel ?? defaultEmpty()}
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
                                <Avatar
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
                                    <span
                                        style={{ display: "block", fontSize: 13 }}
                                    >
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
