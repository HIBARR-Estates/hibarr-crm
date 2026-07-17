import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealAvatar from "./DealAvatar";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

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
}

function initialsFromName(name?: string): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/** Ported from v2.2's PeoplePicker (deal-v2-2.jsx:877-905) — search over employees. */
export default function DealPeoplePicker({
    people,
    exclude = [],
    onPick,
    autoFocus,
    placeholder,
}: DealPeoplePickerProps) {
    const { td } = useTd();
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
                aria-label={placeholder || td("Search employees…")}
                placeholder={placeholder || td("Search employees…")}
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
                        {td("No employees match")} "{query}"
                    </div>
                ) : (
                    results.map((person) => (
                        <button
                            key={person.id}
                            type="button"
                            className="dr-menu-item"
                            onClick={() => onPick(person)}
                        >
                            <DealAvatar
                                type="agent"
                                size={24}
                                initials={initialsFromName(person.name)}
                            />
                            <span
                                style={{ flex: 1, minWidth: 0, textAlign: "left" }}
                            >
                                <span style={{ display: "block", fontSize: 13 }}>
                                    {person.name}
                                </span>
                                {person.designation && (
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 11,
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        {person.designation}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
