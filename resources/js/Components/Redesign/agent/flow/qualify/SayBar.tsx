import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";

/**
 * The line the agent says (canvas L7-07, L7-08): a navy bar with "Say" in
 * blue and the script in quotes. `tone="note"` is the same bar for an
 * instruction, which is not read aloud.
 */
export default function SayBar({ children, tone = "say" }: { children: ReactNode; tone?: "say" | "note" }) {
    const { t } = useTranslation();
    return (
        <div className={`agent-qs__say${tone === "note" ? " agent-qs__say--note" : ""}`}>
            <span className="agent-qs__say-tag">
                {tone === "note" ? t("pages.agent_workspace.flow.instruction") : t("pages.agent_workspace.flow.say")}
            </span>
            <span className="agent-qs__say-sep" aria-hidden="true">
                ·
            </span>
            <div className="agent-qs__say-text">{children}</div>
        </div>
    );
}
