import { useEffect, useRef, useState } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import FloatingDropdown from "../ui/FloatingDropdown";

type SelectOption = string | { value: string; label: string };
function getVal(o: SelectOption) { return typeof o === "string" ? o : o.value; }
function getLbl(o: SelectOption) { return typeof o === "string" ? o : o.label; }

interface SelectInputProps {
    value: string;
    options: SelectOption[];
    placeholder?: string;
    onChange: (value: string) => void;
}

export default function SelectInput({ value, options, placeholder = "Select an option", onChange }: SelectInputProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const inContainer = containerRef.current?.contains(target);
            const inPortal = document.body.lastElementChild?.contains(target);
            if (!inContainer && !inPortal) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between bg-white border rounded-xl px-3 py-2.5 text-sm transition-colors text-left"
                style={
                    open
                        ? { borderColor: "#38bdf8", boxShadow: "0 0 0 2px #e0f2fe" }
                        : { borderColor: T.BORDER }
                }
            >
                <span style={{ color: value ? T.TEXT : T.TEXT_HINT }}>
                    {value ? (getLbl(options.find(o => getVal(o) === value) ?? value) || value) : placeholder}
                </span>
                <svg
                    className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    style={{ color: T.TEXT_MUTED }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <FloatingDropdown anchorRef={triggerRef} open={open}>
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-52 overflow-y-auto py-1">
                        {options.map((opt) => {
                            const v = getVal(opt);
                            return (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => { onChange(v); setOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between"
                                    style={
                                        value === v
                                            ? { backgroundColor: T.NAVY, color: "#fff" }
                                            : { color: T.TEXT }
                                    }
                                >
                                    {getLbl(opt)}
                                    {value === v && (
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#38bdf8" }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </FloatingDropdown>
        </div>
    );
}
