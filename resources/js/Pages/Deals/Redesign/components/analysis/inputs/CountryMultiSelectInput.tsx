import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import FloatingDropdown from "../ui/FloatingDropdown";
import { ANALYSIS_COUNTRIES } from "../data/countries";

interface CountryMultiSelectInputProps {
    value: string[];
    placeholder?: string;
    onChange: (value: string[]) => void;
}

export default function CountryMultiSelectInput({ value, placeholder = "Select countries", onChange }: CountryMultiSelectInputProps) {
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

    const toggle = (name: string) => {
        onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
    };
    const filtered = ANALYSIS_COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
    );
    const selectedCountries = ANALYSIS_COUNTRIES.filter((c) => value.includes(c.name));

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center flex-wrap gap-1.5 bg-white border rounded-xl px-3 py-2 text-sm transition-colors text-left"
                style={{
                    minHeight: 42,
                    ...(open
                        ? { borderColor: "#38bdf8", boxShadow: "0 0 0 2px #e0f2fe" }
                        : { borderColor: T.BORDER }),
                }}
            >
                {selectedCountries.length > 0 ? (
                    selectedCountries.map((c) => (
                        <span
                            key={c.code}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-white"
                            style={{ backgroundColor: T.NAVY }}
                        >
                            {c.flag} {c.name}
                            <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); toggle(c.name); }}
                                className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                            >
                                ×
                            </span>
                        </span>
                    ))
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
                        {filtered.map((c) => {
                            const sel = value.includes(c.name);
                            return (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => toggle(c.name)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                                    style={sel ? { backgroundColor: `${T.NAVY}0d`, color: T.NAVY } : { color: T.TEXT }}
                                >
                                    <span
                                        className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                        style={sel ? { backgroundColor: T.NAVY, borderColor: T.NAVY } : { borderColor: T.BORDER }}
                                    >
                                        {sel && (
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className="text-base">{c.flag}</span>
                                    <span className="flex-1">{c.name}</span>
                                </button>
                            );
                        })}
                        {filtered.length === 0 && (
                            <p className="text-xs px-3 py-3" style={{ color: T.TEXT_HINT }}>{td("No countries found.", { source: "en" })}</p>
                        )}
                    </div>
                </div>
            </FloatingDropdown>
        </div>
    );
}
