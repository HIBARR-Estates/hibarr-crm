import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface Props {
    title: string;
    filled: number;
    total: number;
    isActive: boolean;
    onClick: () => void;
}

export default function AnalysisSectionNavItem({ title, filled, total, isActive, onClick }: Props) {
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const done = total > 0 && pct === 100;

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left py-3 pl-4 pr-3 transition-colors relative"
            style={isActive ? { backgroundColor: T.BLUE_LIGHT } : {}}
            onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = T.SURFACE_2;
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
                className="text-[13px] font-medium leading-snug mb-1.5"
                style={{ color: isActive ? T.NAVY : T.TEXT_MUTED }}
            >
                {title}
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
