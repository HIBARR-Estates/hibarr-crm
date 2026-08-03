import { useEffect, useRef } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

interface Props {
    open: boolean;
    onClose: () => void;
    onScheduleMeeting: () => void;
}

export default function MeetingPopover({ open, onClose, onScheduleMeeting }: Props) {
    const { td } = useTd();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open, onClose]);

    if (!open) return null;

    const handleSchedule = () => {
        onClose();
        onScheduleMeeting();
    };

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
                        style={{ backgroundColor: T.GREEN_LIGHT }}
                    >
                        <svg className="w-3.5 h-3.5" style={{ color: T.GREEN }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: T.TEXT }}>
                        {td("Schedule Meeting")}
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

            <p className="text-xs leading-relaxed" style={{ color: T.TEXT_MUTED }}>
                {td("Open the full meeting scheduler to configure date, time, type, and participants.")}
            </p>

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl border text-xs font-medium transition-colors"
                    style={{ borderColor: T.BORDER, color: T.TEXT_MUTED }}
                >
                    {td("Cancel")}
                </button>
                <button
                    type="button"
                    onClick={handleSchedule}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ border: `1.5px solid ${T.NAVY}`, color: T.NAVY }}
                >
                    {td("Open Scheduler")}
                </button>
            </div>
        </div>
    );
}
