import { useEffect, useRef, useState } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import FloatingDropdown from "../ui/FloatingDropdown";

interface DateInputProps {
    value: string;
    onChange: (value: string) => void;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseISO(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(value: string): string {
    const d = parseISO(value);
    if (!d) return "";
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDay(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

export default function DateInput({ value, onChange }: DateInputProps) {
    const selected = parseISO(value);
    const today = new Date();
    const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
    const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"month" | "year">("month");
    const [yearRangeStart, setYearRangeStart] = useState(
        () => Math.floor((selected?.getFullYear() ?? today.getFullYear()) / 12) * 12,
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !containerRef.current?.contains(target) &&
                !document.body.lastElementChild?.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    };

    const selectDay = (day: number) => {
        const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        onChange(iso);
        setOpen(false);
    };

    const toggleYearMode = () => {
        if (mode === "month") {
            setYearRangeStart(Math.floor(viewYear / 12) * 12);
            setMode("year");
        } else {
            setMode("month");
        }
    };

    const total = daysInMonth(viewYear, viewMonth);
    const offset = firstDay(viewYear, viewMonth);
    const cells = Array.from({ length: offset + total }, (_, i) => i < offset ? null : i - offset + 1);
    const yearCells = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);

    const NavButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
        <button
            type="button"
            onClick={onClick}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: T.TEXT_MUTED }}
        >
            {children}
        </button>
    );

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2.5 bg-white border rounded-xl px-3 py-2.5 text-sm transition-colors text-left"
                style={open ? { borderColor: "#38bdf8", boxShadow: "0 0 0 2px #e0f2fe" } : { borderColor: T.BORDER }}
            >
                <svg
                    className="w-4 h-4 shrink-0"
                    style={{ color: T.TEXT_MUTED }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span style={{ color: value ? T.TEXT : T.TEXT_HINT }}>
                    {value ? formatDateDisplay(value) : "Select a date"}
                </span>
                {value && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(""); }}
                        className="ml-auto transition-colors"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </button>

            <FloatingDropdown anchorRef={triggerRef} open={open} minWidth={288}>
                <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-72">
                    {/* Header — arrows + clickable month/year label */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <NavButton onClick={mode === "year" ? () => setYearRangeStart((s) => s - 12) : prevMonth}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </NavButton>

                        <button
                            type="button"
                            onClick={toggleYearMode}
                            className="flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-sm font-semibold" style={{ color: T.TEXT }}>
                                {mode === "year"
                                    ? `${yearRangeStart} – ${yearRangeStart + 11}`
                                    : `${MONTHS[viewMonth]} ${viewYear}`}
                            </span>
                            <svg
                                className={`w-3.5 h-3.5 transition-transform ${mode === "year" ? "rotate-180" : ""}`}
                                style={{ color: T.TEXT_MUTED }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <NavButton onClick={mode === "year" ? () => setYearRangeStart((s) => s + 12) : nextMonth}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </NavButton>
                    </div>

                    {/* Year picker grid */}
                    {mode === "year" && (
                        <div className="px-3 py-2">
                            <div className="grid grid-cols-4 gap-1">
                                {yearCells.map((y) => {
                                    const isSelected = y === viewYear;
                                    const isCurrent = y === today.getFullYear();
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            onClick={() => { setViewYear(y); setMode("month"); }}
                                            className="h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-slate-100"
                                            style={
                                                isSelected
                                                    ? { backgroundColor: T.NAVY, color: "#fff" }
                                                    : isCurrent
                                                        ? { backgroundColor: T.BLUE_LIGHT, color: T.NAVY }
                                                        : { color: T.TEXT }
                                            }
                                        >
                                            {y}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Month/day grid */}
                    {mode === "month" && (
                        <div className="px-3 py-2">
                            <div className="grid grid-cols-7 mb-1">
                                {DAYS_SHORT.map((d) => (
                                    <div
                                        key={d}
                                        className="text-center text-[10px] font-semibold uppercase tracking-wider py-1"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-y-0.5">
                                {cells.map((day, i) => {
                                    if (!day) return <div key={`e-${i}`} />;
                                    const isSel = selected &&
                                        selected.getFullYear() === viewYear &&
                                        selected.getMonth() === viewMonth &&
                                        selected.getDate() === day;
                                    const isToday =
                                        today.getFullYear() === viewYear &&
                                        today.getMonth() === viewMonth &&
                                        today.getDate() === day;
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => selectDay(day)}
                                            className="h-8 w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-slate-100"
                                            style={
                                                isSel
                                                    ? { backgroundColor: T.NAVY, color: "#fff" }
                                                    : isToday
                                                        ? { backgroundColor: T.BLUE_LIGHT, color: T.NAVY }
                                                        : { color: T.TEXT }
                                            }
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="px-3 py-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                setViewMonth(today.getMonth());
                                setViewYear(today.getFullYear());
                                setMode("month");
                                selectDay(today.getDate());
                            }}
                            className="w-full text-center text-xs font-medium py-1 transition-colors hover:opacity-70"
                            style={{ color: T.NAVY }}
                        >
                            Today
                        </button>
                    </div>
                </div>
            </FloatingDropdown>
        </div>
    );
}
