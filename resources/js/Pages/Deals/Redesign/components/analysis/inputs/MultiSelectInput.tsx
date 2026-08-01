import type { FieldOption } from "./fieldValueCodecs";

interface MultiSelectInputProps {
    value: string[];
    options: FieldOption[];
    disabled?: boolean;
    onChange: (value: string[]) => void;
}

export default function MultiSelectInput({ value, options, disabled, onChange }: MultiSelectInputProps) {
    const toggle = (opt: string) => {
        if (disabled) return;
        onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
    };

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((o) => {
                const selected = value.includes(o.value);
                return (
                    <button
                        key={o.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(o.value)}
                        className="px-3 py-1.5 rounded-md text-sm font-medium transition-all border flex items-center gap-1.5 disabled:opacity-40"
                        style={
                            selected
                                ? { backgroundColor: "#0A2E5D", color: "#fff", borderColor: "#0A2E5D" }
                                : { backgroundColor: "#fff", color: "#64748b", borderColor: "#e2e8f0" }
                        }
                    >
                        {selected && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#38bdf8" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
