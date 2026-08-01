import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

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
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const v = getVal(opt);
                return (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChange(v)}
                        className="px-4 py-2 rounded-md text-sm font-medium transition-all border"
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
