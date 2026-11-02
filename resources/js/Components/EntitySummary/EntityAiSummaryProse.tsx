import { Fragment } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface EntityAiSummaryProseProps {
    /**
     * Plain prose from the model. `**…**` marks a key fact, `==…==` the one
     * open item or risk.
     */
    text: string;
}

const MARKER = /(\*\*[^*]+\*\*|==[^=]+==)/g;

/**
 * Renders the lead summary paragraph. Markers are parsed into <mark> elements —
 * never injected as HTML, since the text is model output.
 */
export default function EntityAiSummaryProse({
    text,
}: EntityAiSummaryProseProps) {
    const { td } = useTd();
    const translated = td(text, { source: "en" });

    return (
        <p className="entity-ai-summary-prose">
            {translated.split(MARKER).map((part, index) => {
                if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
                    return (
                        <mark
                            key={index}
                            className="entity-ai-summary-prose__mark entity-ai-summary-prose__mark--fact"
                        >
                            {part.slice(2, -2)}
                        </mark>
                    );
                }

                if (part.length > 4 && part.startsWith("==") && part.endsWith("==")) {
                    return (
                        <mark
                            key={index}
                            className="entity-ai-summary-prose__mark entity-ai-summary-prose__mark--open"
                        >
                            {part.slice(2, -2)}
                        </mark>
                    );
                }

                // A stray, unmatched marker is dropped rather than shown.
                return (
                    <Fragment key={index}>
                        {part.replace(/\*\*|==/g, "")}
                    </Fragment>
                );
            })}
        </p>
    );
}
