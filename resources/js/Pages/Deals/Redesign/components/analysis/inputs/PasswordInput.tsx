import { useState } from "react";

interface PasswordInputProps {
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onBlur?: () => void;
}

export default function PasswordInput({ value, disabled, onChange, onBlur }: PasswordInputProps) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative flex items-center">
            <input
                type={show ? "text" : "password"}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder="Enter value…"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-colors pr-10 disabled:opacity-40"
            />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={show ? "Hide password" : "Show password"}
            >
                {show ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
