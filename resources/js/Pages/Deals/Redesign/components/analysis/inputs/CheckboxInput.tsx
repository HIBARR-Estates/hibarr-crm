import type { FieldOption } from "./fieldValueCodecs";

interface CheckboxInputProps {
    value: string[];
    options: FieldOption[];
    disabled?: boolean;
    onChange: (value: string[]) => void;
}

export default function CheckboxInput({ value, options, disabled, onChange }: CheckboxInputProps) {
    const toggle = (opt: string) => {
        if (disabled) return;
        const next = value.includes(opt)
            ? value.filter((v) => v !== opt)
            : [...value, opt];
        onChange(next);
    };

    return (
        <div className="flex flex-col gap-2">
            {options.map((o) => {
                const checked = value.includes(o.value);
                return (
                    <label
                        key={o.value}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors border"
                        style={{
                            backgroundColor: checked ? "#f0f9ff" : "#fff",
                            borderColor: checked ? "#38bdf8" : "#e2e8f0",
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <div
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                            style={{
                                backgroundColor: checked ? "#0A2E5D" : "#fff",
                                border: checked ? "none" : "1.5px solid #cbd5e1",
                            }}
                        >
                            {checked && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(o.value)}
                            className="sr-only"
                        />
                        <span className="text-sm text-slate-800">{o.label}</span>
                    </label>
                );
            })}
        </div>
    );
}
