import type { FieldOption } from "./fieldValueCodecs";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

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
                                ? { backgroundColor: T.NAVY, color: "#fff", borderColor: T.NAVY }
                                : { backgroundColor: "#fff", color: T.TEXT_MUTED, borderColor: T.BORDER }
                        }
                    >
                        {selected && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: T.SKY }}>
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
