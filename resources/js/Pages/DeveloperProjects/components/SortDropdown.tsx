import { Select } from "antd";
import { SORT_OPTIONS } from "../constants/projects";

interface SortDropdownProps {
    value: string;
    onChange: (value: string) => void;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ value, onChange }) => {

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Sort by</span>
            <Select
                value={value}
                onChange={onChange}
                options={SORT_OPTIONS}
                style={{ width: 190 }}
                size="middle"
            />
        </div>
    );
};

export { SORT_OPTIONS };
export default SortDropdown;
