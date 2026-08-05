import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

interface SelectCheckboxProps {
    checked: boolean;
    onChange: () => void;
    label: string;
}

/** Row-select checkbox for bulk-select mode. */
export default function SelectCheckbox({
    checked,
    onChange,
    label,
}: SelectCheckboxProps) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={label}
            onClick={(e) => {
                e.stopPropagation();
                onChange();
            }}
            style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 6,
                margin: -6,
                display: "flex",
                flexShrink: 0,
            }}
        >
            <span
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${checked ? T.BLUE : T.BORDER}`,
                    background: checked ? T.BLUE : T.WHITE,
                }}
            >
                {checked && <Icon name="check" size={11} color={T.WHITE} />}
            </span>
        </button>
    );
}
