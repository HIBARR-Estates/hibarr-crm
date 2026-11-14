import { Fragment } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { usePersonalize } from "./SummaryPersonalization";

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
    const personalize = usePersonalize();
    // Translate first, then fill in the lead's name: the name never reaches the
    // translation service, and it is substituted before the highlight markers are
    // parsed (names are stripped of marker characters, so they cannot add one).
    const translated = personalize(td(text, { source: "en" }));

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
