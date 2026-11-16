import { useMemo } from "react";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import { protectScriptForTranslation } from "./qualificationUtils";

/**
 * Translates a qualification script label (say/ask/instruction/outcome
 * body) without corrupting embedded OL rich-text HTML or
 * `{{lead.firstName}}` / `{leadName}` tokens — those are protected before
 * the string reaches the translation API and restored afterward. Falls
 * back to the original label while translation is pending, or if the
 * placeholder round trip breaks.
 */
export const useTranslatedScriptLabel = (
    label: string | null | undefined,
): string => {
    const source = label ?? "";
    const protectedScript = useMemo(
        () => protectScriptForTranslation(source),
        [source],
    );
    const translatedProtected = useDynamicTranslation(protectedScript.text, {
        source: "en",
    });

    if (translatedProtected === protectedScript.text) {
        return source;
    }

    return protectedScript.restore(translatedProtected) ?? source;
};
