import { useState, useCallback } from "react";
import {
    isAiEnabled,
    getMinimumFieldsPresent,
    generatePropertyDescription,
    toUserFriendlyError,
} from "./geminiClient";

export interface UseGenerateDescriptionReturn {
    /** Whether AI features are available (API key is configured) */
    isEnabled: boolean;
    /** Whether a generation request is in progress */
    isGenerating: boolean;
    /** Error message from the last attempt (cleared on next attempt) */
    error: string | null;
    /** Insufficient-data message (set when fields are missing) */
    insufficientMessage: string | null;
    /**
     * Trigger description generation.
     * @param formData – full form values from the property form
     * @returns The generated description text, or null on failure
     */
    generate: (formData: Record<string, any>) => Promise<string | null>;
}

/**
 * React hook that wraps the Gemini AI description generator.
 *
 * Manages loading, error, and insufficient-data states.
 */
export function useGenerateDescription(): UseGenerateDescriptionReturn {
    const isEnabled = isAiEnabled();
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [insufficientMessage, setInsufficientMessage] = useState<
        string | null
    >(null);

    const generate = useCallback(
        async (formData: Record<string, any>): Promise<string | null> => {
            // Reset previous state
            setError(null);
            setInsufficientMessage(null);

            // Validate minimum fields
            const check = getMinimumFieldsPresent(formData);
            if (!check.sufficient) {
                setInsufficientMessage(
                    `Please fill in ${check.missing.join(" and ")} before generating a description.`,
                );
                return null;
            }

            setIsGenerating(true);
            try {
                const description = await generatePropertyDescription(formData);
                return description;
            } catch (err: unknown) {
                setError(toUserFriendlyError(err));
                return null;
            } finally {
                setIsGenerating(false);
            }
        },
        [],
    );

    return { isEnabled, isGenerating, error, insufficientMessage, generate };
}
