import type { ReactNode } from "react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface AgentCardSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}

/** The search field inside a contact card (canvas L8): narrows the card's own rows. */
export function AgentCardSearch({ value, onChange, placeholder }: AgentCardSearchProps) {
    return (
        <label className="agent-cardctl__search">
            <Icon name="search" size={13} />
            <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </label>
    );
}

export interface AgentCardFilterOption<T extends string> {
    value: T;
    label: string;
}

interface AgentCardFiltersProps<T extends string> {
    options: Array<AgentCardFilterOption<T>>;
    value: T;
    onChange: (value: T) => void;
    label: string;
}

/** One-tap filters inside a contact card: All, then the kinds of row it holds. */
export function AgentCardFilters<T extends string>({ options, value, onChange, label }: AgentCardFiltersProps<T>) {
    const { td } = useTd();
    return (
        <div className="agent-cardctl__chips" role="group" aria-label={label}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className="agent-cardctl__chip"
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    {td(option.label, { source: "en" })}
                </button>
            ))}
        </div>
    );
}

/** The row under a card's title that holds its search and filters. */
export function AgentCardControls({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="agent-cardctl">
            {children}
            {aside ? <span className="agent-cardctl__aside">{aside}</span> : null}
        </div>
    );
}

/** Case-insensitive match of a search over a row's texts; an empty search matches all. */
export function matchesCardSearch(query: string, ...texts: Array<string | null | undefined>): boolean {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    return texts.some((text) => (text ?? "").toLocaleLowerCase().includes(needle));
}
