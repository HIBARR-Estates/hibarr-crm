import Icon from "@/Components/Redesign/primitives/Icon";

interface AgentListSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label?: string;
}

/**
 * The in-list search of the People, Deals, Tasks and Portfolio screens: a white
 * field on the navy band, right-aligned on its own row under the title. One
 * component so the four lists place and style it the same way.
 */
export default function AgentListSearch({ value, onChange, placeholder, label }: AgentListSearchProps) {
    return (
        <div className="agent-list-search-row">
            <label className="agent-list-search">
                <Icon name="search" size={14} />
                <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label ?? placeholder} />
            </label>
        </div>
    );
}
