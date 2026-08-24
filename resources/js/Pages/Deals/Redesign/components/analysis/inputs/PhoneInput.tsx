import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import FloatingDropdown from "../ui/FloatingDropdown";
import { ANALYSIS_COUNTRIES } from "../data/countries";

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
}

function parse(value: string): { dial: string; number: string } {
    if (value.includes("|")) {
        const [dial = "+44", number = ""] = value.split("|");
        return { dial, number };
    }
    // Plain string (pre-migration data) — treat whole value as the number
    return { dial: "+44", number: value || "" };
}

export default function PhoneInput({ value, onChange }: PhoneInputProps) {
    const { td } = useTd();
    const { dial, number } = parse(value);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                !containerRef.current?.contains(e.target as Node) &&
                !document.body.lastElementChild?.contains(e.target as Node)
            ) {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = ANALYSIS_COUNTRIES.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.dial.includes(search),
    );
    const selectedCountry = ANALYSIS_COUNTRIES.find((c) => c.dial === dial) || ANALYSIS_COUNTRIES[0];
    const update = (newDial: string, newNumber: string) => onChange(`${newDial}|${newNumber}`);

    return (
        <div ref={containerRef} className="flex items-center w-full min-w-0">
            <div className="relative shrink-0">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="h-10 flex items-center gap-1.5 px-3 bg-white border border-r-0 rounded-l-xl text-sm transition-colors"
                    style={
                        open
                            ? { borderColor: "#38bdf8", boxShadow: "0 0 0 2px #e0f2fe", zIndex: 10 }
                            : { borderColor: T.BORDER }
                    }
                >
                    <span className="text-base leading-none">{selectedCountry.flag}</span>
                    <span className="font-medium tabular-nums" style={{ color: T.TEXT_MUTED }}>{dial}</span>
                    <svg
                        className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
                        style={{ color: T.TEXT_MUTED }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <FloatingDropdown anchorRef={triggerRef} open={open} minWidth={256}>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                            <input
                                autoFocus
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={td("Search country...", { source: "en" })}
                                className="w-full text-sm px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400"
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto py-1">
                            {filtered.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => { update(c.dial, number); setOpen(false); setSearch(""); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                                    style={c.dial === dial ? { backgroundColor: T.NAVY, color: "#fff" } : { color: T.TEXT }}
                                >
                                    <span className="text-base">{c.flag}</span>
                                    <span className="flex-1">{c.name}</span>
                                    <span className="tabular-nums text-xs opacity-60">{c.dial}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </FloatingDropdown>
            </div>

            {/* min-w-0: without it the input's intrinsic width wins over flex-1
                and the control overflows narrow containers (300px qualify panel). */}
            <input
                type="text"
                inputMode="tel"
                value={number}
                placeholder={td("Enter number...", { source: "en" })}
                onChange={(e) => update(dial, e.target.value.replace(/[^0-9 \-()]/g, ""))}
                className="flex-1 min-w-0 h-10 bg-white border border-slate-200 rounded-r-xl px-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-colors"
                style={{ color: T.TEXT }}
            />
        </div>
    );
}
