import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import FloatingDropdown from "../ui/FloatingDropdown";
import { ANALYSIS_CURRENCIES } from "../data/currencies";

interface CurrencyInputProps {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

function parse(value: string): { code: string; amount: string } {
    const [code = "GBP", amount = ""] = value.split("|");
    return { code, amount };
}

function fmt(raw: string): string {
    const digits = raw.replace(/[^0-9]/g, "");
    return digits ? parseInt(digits).toLocaleString("en-GB") : "";
}

export default function CurrencyInput({ value, placeholder, onChange }: CurrencyInputProps) {
    const { td } = useTd();
    const { code, amount } = parse(value);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const currency = ANALYSIS_CURRENCIES.find((c) => c.code === code) ?? ANALYSIS_CURRENCIES[0];
    const filtered = ANALYSIS_CURRENCIES.filter(
        (c) =>
            c.code.toLowerCase().includes(search.toLowerCase()) ||
            c.name.toLowerCase().includes(search.toLowerCase()),
    );

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

    const update = (newCode: string, newAmount: string) => onChange(`${newCode}|${newAmount}`);

    return (
        // Fills its container; callers constrain the width (the left panel's edit
        // area is far narrower than the centre panel's).
        <div ref={containerRef} className="flex items-center w-full">
            <div className="relative shrink-0">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="h-10 flex items-center gap-1.5 px-3 border border-r-0 rounded-l-xl text-sm font-semibold transition-colors"
                    style={
                        open
                            ? { backgroundColor: T.BLUE_LIGHT, borderColor: "#38bdf8", boxShadow: "0 0 0 2px #e0f2fe", zIndex: 10 }
                            : { backgroundColor: T.SURFACE_2, borderColor: T.BORDER }
                    }
                >
                    <span style={{ color: T.TEXT }}>{currency.code}</span>
                    <span className="text-xs" style={{ color: T.TEXT_MUTED }}>{currency.symbol}</span>
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

                <FloatingDropdown anchorRef={triggerRef} open={open} minWidth={240}>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                            <input
                                autoFocus
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={td("Search currency...", { source: "en" })}
                                className="w-full text-sm px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400"
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto py-1">
                            {filtered.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => { update(c.code, amount); setOpen(false); setSearch(""); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
                                    style={c.code === code ? { backgroundColor: T.NAVY, color: "#fff" } : { color: T.TEXT }}
                                >
                                    <span className="font-semibold w-10 shrink-0">{c.code}</span>
                                    <span className="text-xs" style={{ opacity: c.code === code ? 0.7 : 1, color: c.code === code ? "#fff" : T.TEXT_MUTED }}>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </FloatingDropdown>
            </div>

            <div className="relative flex-1">
                <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none select-none"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {currency.symbol}
                </span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={fmt(amount)}
                    placeholder={placeholder || "0"}
                    onChange={(e) => update(code, e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full h-10 bg-white border border-slate-200 rounded-r-xl pl-7 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-colors"
                    style={{ color: T.TEXT }}
                />
            </div>
        </div>
    );
}
