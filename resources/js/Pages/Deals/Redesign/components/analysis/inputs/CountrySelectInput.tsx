import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import FloatingDropdown from "../ui/FloatingDropdown";
import { ANALYSIS_COUNTRIES } from "../data/countries";

interface CountrySelectInputProps {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

export default function CountrySelectInput({ value, placeholder = "Select a country", onChange }: CountrySelectInputProps) {
    const { td } = useTd();
    const resolvedPlaceholder = td(placeholder, { source: "en" });
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

    const selected = ANALYSIS_COUNTRIES.find((c) => c.name === value);
    const filtered = ANALYSIS_COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 text-sm transition-colors text-left"
                style={open ? { borderColor: "#38bdf8", boxShadow: "0 0 0 2px #e0f2fe" } : { borderColor: T.BORDER }}
            >
                {selected ? (
                    <>
                        <span className="text-base leading-none">{selected.flag}</span>
                        <span style={{ color: T.TEXT }}>{selected.name}</span>
                    </>
                ) : (
                    <span style={{ color: T.TEXT_HINT }}>{resolvedPlaceholder}</span>
                )}
                <svg
                    className={`w-4 h-4 ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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
                            placeholder={td("Search countries...", { source: "en" })}
                            className="w-full text-sm px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                        {filtered.map((c) => (
                            <button
                                key={c.code}
                                type="button"
                                onClick={() => { onChange(c.name); setOpen(false); setSearch(""); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                                style={value === c.name ? { backgroundColor: T.NAVY, color: "#fff" } : { color: T.TEXT }}
                            >
                                <span className="text-base">{c.flag}</span>
                                <span className="flex-1">{c.name}</span>
                                {value === c.name && (
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#38bdf8" }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-xs px-3 py-3" style={{ color: T.TEXT_HINT }}>{td("No countries found.", { source: "en" })}</p>
                        )}
                    </div>
                </div>
            </FloatingDropdown>
        </div>
    );
}
