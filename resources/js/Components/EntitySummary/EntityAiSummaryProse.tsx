import { Fragment } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface EntityAiSummaryProseProps {
    /** Plain prose; `**…**` marks the few facts the model chose to highlight. */
    text: string;
}

/**
 * Renders the lead summary paragraph. Highlights are parsed into <strong>
 * elements — never injected as HTML, since the text is model output.
 */
export default function EntityAiSummaryProse({
    text,
}: EntityAiSummaryProseProps) {
    const { td } = useTd();
    const translated = td(text, { source: "en" });

    return (
        <p className="entity-ai-summary-prose">
            {translated.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
                part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
                    <strong key={index}>{part.slice(2, -2)}</strong>
                ) : (
                    <Fragment key={index}>{part.replace(/\*\*/g, "")}</Fragment>
                ),
            )}
        </p>
    );
}
