import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { SORT_OPTIONS } from "../constants/projects";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface SortDropdownProps {
    value: string;
    onChange: (value: string) => void;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ value, onChange }) => {
    const { td } = useTd();
    return (
        <div className="flex items-center gap-2">
            <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: T.TEXT_MUTED }}
            >
                {td("Sort by", { source: "en" })}
            </span>
            <MenuSelect
                value={value}
                onChange={(next) => onChange(String(next))}
                options={SORT_OPTIONS}
                width={190}
            />
        </div>
    );
};

export { SORT_OPTIONS };
export default SortDropdown;
