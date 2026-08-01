// Internal format: "min,max" (comma-separated). Convert from/to {min,max} JSON at the form layer.

interface NumberRangeInputProps {
    value: string;
    unit?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
}

function parse(value: string): [string, string] {
    const [a = "", b = ""] = value.split(",");
    return [a, b];
}

const fieldClass =
    "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-colors disabled:opacity-40";

export default function NumberRangeInput({ value, unit, disabled, onChange }: NumberRangeInputProps) {
    const [min, max] = parse(value);

    const update = (side: "min" | "max", raw: string) => {
        if (disabled) return;
        const digits = raw.replace(/[^0-9]/g, "");
        if (side === "min") onChange(`${digits},${max}`);
        else onChange(`${min},${digits}`);
    };

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Min</label>
                <div className="relative">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={min}
                        placeholder="0"
                        disabled={disabled}
                        onChange={(e) => update("min", e.target.value)}
                        className={fieldClass}
                    />
                    {unit && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
                    )}
                </div>
            </div>
            <span className="text-slate-300 mt-5">—</span>
            <div className="flex-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Max</label>
                <div className="relative">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={max}
                        placeholder="0"
                        disabled={disabled}
                        onChange={(e) => update("max", e.target.value)}
                        className={fieldClass}
                    />
                    {unit && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
