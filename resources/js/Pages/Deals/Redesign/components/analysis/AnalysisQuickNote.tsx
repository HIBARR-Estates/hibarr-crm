import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

export default function AnalysisQuickNote() {
    const { deal } = useDealWorkspace();
    const { td } = useTd();
    const [text, setText] = useState("");
    const { createNote, isSaving } = useDealNoteCreate(deal.id);

    const save = () => {
        if (!text.trim()) return;
        createNote({ text }, () => setText(""));
    };

    return (
        <div className="flex flex-col gap-2">
            <textarea
                className="w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none transition-shadow"
                style={{
                    borderColor: T.BORDER,
                    color: T.TEXT,
                    minHeight: 68,
                    fontFamily: "inherit",
                    background: T.SURFACE_2,
                }}
                placeholder={td("Add a note about this call...")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = T.BLUE_MID;
                    e.target.style.boxShadow = `0 0 0 2px ${T.BLUE_LIGHT}`;
                    e.target.style.background = T.WHITE;
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = T.BORDER;
                    e.target.style.boxShadow = "none";
                    e.target.style.background = T.SURFACE_2;
                }}
            />
            {text.trim() && (
                <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: T.TEXT_HINT }}>
                        {td("⌘↵ to save")}
                    </span>
                    <button
                        type="button"
                        className="dr-btn dr-btn-primary dr-btn-sm"
                        disabled={isSaving}
                        onClick={save}
                    >
                        {isSaving ? td("Saving...") : td("Save note")}
                    </button>
                </div>
            )}
        </div>
    );
}
