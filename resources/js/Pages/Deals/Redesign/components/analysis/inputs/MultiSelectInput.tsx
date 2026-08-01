import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

interface MultiSelectInputProps {
    value: string[];
    options: string[];
    onChange: (value: string[]) => void;
}

export default function MultiSelectInput({ value, options, onChange }: MultiSelectInputProps) {
    const toggle = (opt: string) => {
        onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
    };

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const selected = value.includes(opt);
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(opt)}
                        className="px-4 py-2 rounded-md text-sm font-medium transition-all border flex items-center gap-1.5"
                        style={
                            selected
                                ? { backgroundColor: T.NAVY, color: "#fff", borderColor: T.NAVY }
                                : { backgroundColor: "#fff", color: T.TEXT_MUTED, borderColor: T.BORDER }
                        }
                    >
                        {selected && (
                            <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                style={{ color: "#38bdf8" }}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {opt}
                    </button>
                );
            })}
        </div>
    );
}
