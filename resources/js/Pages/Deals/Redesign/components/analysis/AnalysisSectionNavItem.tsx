import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface Props {
    title: string;
    filled: number;
    total: number;
    isActive: boolean;
    isLocked?: boolean;
    onClick: () => void;
}

export default function AnalysisSectionNavItem({ title, filled, total, isActive, isLocked = false, onClick }: Props) {
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const done = total > 0 && pct === 100;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLocked}
            aria-disabled={isLocked}
            className="w-full text-left py-3 pl-4 pr-3 transition-colors relative disabled:cursor-not-allowed"
            style={isActive ? { backgroundColor: T.BLUE_LIGHT } : isLocked ? { opacity: 0.45 } : {}}
            onMouseEnter={(e) => {
                if (!isActive && !isLocked) (e.currentTarget as HTMLElement).style.backgroundColor = T.SURFACE_2;
            }}
            onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "";
            }}
        >
            {/* Left accent bar */}
            <div
                className="absolute left-0 top-0 bottom-0 w-0.5 transition-all"
                style={{ backgroundColor: isActive ? "#38bdf8" : "transparent" }}
            />

            <div
                className="text-[13px] font-medium leading-snug mb-1.5 flex items-center gap-1.5"
                style={{ color: isActive ? T.NAVY : T.TEXT_MUTED }}
            >
                {isLocked && (
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                )}
                <span className="min-w-0 truncate">{title}</span>
            </div>

            {total > 0 && (
                <div className="flex items-center gap-1.5">
                    <div
                        className="flex-1 h-1 rounded-full overflow-hidden"
                        style={{ backgroundColor: T.BORDER }}
                    >
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${pct}%`,
                                backgroundColor: done ? "#10b981" : "#38bdf8",
                            }}
                        />
                    </div>
                    <span
                        className="text-[11px] tabular-nums font-medium w-7 text-right shrink-0"
                        style={{ color: done ? "#10b981" : isActive ? "#38bdf8" : T.TEXT_HINT }}
                    >
                        {pct}%
                    </span>
                </div>
            )}
        </button>
    );
}
