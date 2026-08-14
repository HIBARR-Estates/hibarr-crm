import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface QualifyContextNoteProps {
    value: string;
    onChange: (value: string) => void;
    /** Free-text answer vs optional context under a choice question. */
    mode?: "context" | "answer";
}

/** Always-visible note field, Analysis question textarea styling. */
export default function QualifyContextNote({
    value,
    onChange,
    mode = "context",
}: QualifyContextNoteProps) {
    const { td } = useTd();
    const isAnswer = mode === "answer";

    return (
        <div className="shrink-0 px-6 py-3 bg-white border-t border-slate-200">
            <p
                className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: T.TEXT }}
            >
                {isAnswer
                    ? td("Answer", { source: "en" })
                    : td("Context note", { source: "en" })}
            </p>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={
                    isAnswer
                        ? td("Type the lead's answer here…", { source: "en" })
                        : td("Add extra context from the call…", {
                              source: "en",
                          })
                }
                rows={3}
                className="w-full resize-y rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none transition-colors"
                style={{
                    border: `1px solid ${T.BORDER}`,
                    color: T.TEXT,
                    fontFamily: "inherit",
                    background: "#f8fafc",
                    minHeight: 72,
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = "#38bdf8";
                    e.target.style.boxShadow = "0 0 0 2px #e0f2fe";
                    e.target.style.background = "#fff";
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = T.BORDER;
                    e.target.style.boxShadow = "none";
                    e.target.style.background = "#f8fafc";
                }}
            />
        </div>
    );
}
