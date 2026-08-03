interface Props {
    number?: number;
    answered: boolean;
    label?: string;
    isRequired?: boolean;
    isConditional?: boolean;
    children: React.ReactNode;
}

export default function AnalysisFieldRow({ number, answered, label, isRequired, isConditional, children }: Props) {
    return (
        <div
            className={`flex gap-4 mb-7${isConditional ? " pl-7 border-l-2 border-indigo-200 ml-3" : ""}`}
        >
            {/* Numbered / answered badge */}
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all"
                style={
                    answered
                        ? { backgroundColor: "#d1fae5", color: "#065f46", boxShadow: "0 0 0 2px #a7f3d0" }
                        : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
                }
            >
                {answered ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    number ?? "·"
                )}
            </div>

            {/* Label + input */}
            <div className="flex-1 min-w-0">
                {label && (
                    <p className="text-sm font-medium text-slate-800 leading-snug mb-2">
                        {label}
                        {isRequired && <span className="text-indigo-400 ml-0.5">*</span>}
                    </p>
                )}
                {children}
            </div>
        </div>
    );
}
