interface NumberInputProps {
    value: string;
    placeholder?: string;
    min?: number;
    max?: number;
    disabled?: boolean;
    onChange: (value: string) => void;
    /**
     * Fired when the value should be persisted — on input blur, and immediately
     * after a stepper click (which may never blur the input).
     */
    onCommit?: (value: string) => void;
}

export default function NumberInput({ value, placeholder, min, max, disabled, onChange, onCommit }: NumberInputProps) {
    const numeric = parseInt(value) || 0;

    const step = (delta: number) => {
        if (disabled) return;
        const next = numeric + delta;
        if (min !== undefined && next < min) return;
        if (max !== undefined && next > max) return;
        onChange(String(next));
        onCommit?.(String(next));
    };

    return (
        <div className="flex items-center gap-0 w-fit">
            <button
                type="button"
                disabled={disabled}
                onClick={() => step(-1)}
                className="w-9 h-10 flex items-center justify-center border border-slate-200 rounded-l-xl bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-r-0 disabled:opacity-40"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
            </button>
            <input
                type="text"
                inputMode="numeric"
                value={value}
                placeholder={placeholder || "0"}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={(e) => onCommit?.(e.target.value)}
                className="w-24 h-10 bg-white border border-slate-200 px-3 text-sm text-center text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-colors disabled:opacity-40"
            />
            <button
                type="button"
                disabled={disabled}
                onClick={() => step(1)}
                className="w-9 h-10 flex items-center justify-center border border-slate-200 rounded-r-xl bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-l-0 disabled:opacity-40"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </div>
    );
}
