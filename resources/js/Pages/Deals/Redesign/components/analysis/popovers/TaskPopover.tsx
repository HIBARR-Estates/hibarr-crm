import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import { useDealWorkspace } from "../../../context/DealWorkspaceContext";
import useDealTaskCreate from "../../../hooks/useDealTaskCreate";

interface Props {
    open: boolean;
    onClose: () => void;
}

function todayISO() {
    return new Date().toISOString().split("T")[0];
}
function offsetISO(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
}
function endOfWeekISO() {
    const d = new Date();
    const diff = 7 - d.getDay();
    return offsetISO(diff);
}

const DUE_OPTIONS = [
    { label: "Today", value: () => todayISO() },
    { label: "Tomorrow", value: () => offsetISO(1) },
    { label: "This week", value: () => endOfWeekISO() },
    { label: "No due date", value: () => "" },
] as const;

const PRIORITY_OPTIONS = [
    { label: "Low", value: "low" as const },
    { label: "Normal", value: "medium" as const },
    { label: "High", value: "high" as const },
    { label: "Highest", value: "highest" as const },
    { label: "Urgent", value: "urgent" as const },
];

export default function TaskPopover({ open, onClose }: Props) {
    const { td } = useTd();
    const { deal } = useDealWorkspace();
    const { createTask, isCreating, errors } = useDealTaskCreate(deal.id);
    const ref = useRef<HTMLDivElement>(null);

    const [title, setTitle] = useState("");
    const [dueIdx, setDueIdx] = useState(0);
    const [priority, setPriority] = useState<
        "low" | "medium" | "high" | "highest" | "urgent"
    >("medium");

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open, onClose]);

    if (!open) return null;

    const handleCreate = () => {
        const dueDate = DUE_OPTIONS[dueIdx].value();
        createTask({ title, dueDate: dueDate || undefined, priority }, () => {
            setTitle("");
            setDueIdx(0);
            setPriority("medium");
            onClose();
        });
    };

    const inputClass =
        "w-full bg-white border rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-colors";

    return (
        <div
            ref={ref}
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 rounded-2xl p-4 space-y-3"
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                boxShadow: "0 20px 60px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: T.BLUE_LIGHT }}
                    >
                        <svg className="w-3.5 h-3.5" style={{ color: T.BLUE }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: T.TEXT }}>
                        {td("New Task", { source: "en" })}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="transition-colors"
                    style={{ color: T.TEXT_MUTED }}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Title */}
            <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && title.trim() && handleCreate()}
                placeholder={td("Task title", { source: "en" })}
                className={inputClass}
                style={{ color: T.TEXT, borderColor: T.BORDER }}
            />

            {/* Due + Priority */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: T.TEXT_MUTED }}>
                        {td("Due", { source: "en" })}
                    </label>
                    <select
                        value={dueIdx}
                        onChange={(e) => setDueIdx(Number(e.target.value))}
                        className="w-full bg-white border rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-sky-400 transition-colors"
                        style={{ color: T.TEXT, borderColor: T.BORDER }}
                    >
                        {DUE_OPTIONS.map((o, i) => (
                            <option key={o.label} value={i}>{td(o.label, { source: "en" })}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: T.TEXT_MUTED }}>
                        {td("Priority", { source: "en" })}
                    </label>
                    <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full bg-white border rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-sky-400 transition-colors"
                        style={{ color: T.TEXT, borderColor: T.BORDER }}
                    >
                        {PRIORITY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{td(o.label, { source: "en" })}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <p className="text-xs" style={{ color: "#dc2626" }}>{errors[0]}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl border text-xs font-medium transition-colors"
                    style={{ borderColor: T.BORDER, color: T.TEXT_MUTED }}
                >
                    {td("Cancel", { source: "en" })}
                </button>
                <button
                    type="button"
                    disabled={!title.trim() || isCreating}
                    onClick={handleCreate}
                    className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: T.NAVY }}
                >
                    {isCreating ? td("Creating…", { source: "en" }) : td("Create Task", { source: "en" })}
                </button>
            </div>
        </div>
    );
}
