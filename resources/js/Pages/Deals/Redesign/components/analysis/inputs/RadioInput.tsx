import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import { handleOptionGroupArrows } from "./optionGroupNav";

type RadioOption = string | { value: string; label: string };
function getVal(o: RadioOption) { return typeof o === "string" ? o : o.value; }
function getLbl(o: RadioOption) { return typeof o === "string" ? o : o.label; }

interface RadioInputProps {
    value: string;
    options: RadioOption[];
    onChange: (value: string) => void;
}

export default function RadioInput({ value, options, onChange }: RadioInputProps) {
    return (
        <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            data-option-group
            onKeyDown={(e) =>
                handleOptionGroupArrows(e, "button", (index) =>
                    onChange(getVal(options[index])),
                )
            }
        >
            {options.map((opt) => {
                const v = getVal(opt);
                return (
                    <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={value === v}
                        onClick={() => onChange(v)}
                        className="px-4 py-2 rounded-md text-sm font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1"
                        style={
                            value === v
                                ? { backgroundColor: T.NAVY, color: "#fff", borderColor: T.NAVY }
                                : { backgroundColor: "#fff", color: T.TEXT_MUTED, borderColor: T.BORDER }
                        }
                    >
                        {getLbl(opt)}
                    </button>
                );
            })}
        </div>
    );
}
