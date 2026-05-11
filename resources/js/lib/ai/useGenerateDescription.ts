import { useState, useCallback } from "react";
import {
    isAiEnabled,
    getMinimumFieldsPresent,
    generatePropertyDescription,
    toUserFriendlyError,
    type FieldCheck,
    type GenerateDescriptionOptions,
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

export interface UseGenerateDescriptionHookOptions {
    endpoint?: string;
    featureContext?: string;
    validateFormData?: (formData: Record<string, any>) => FieldCheck;
}

/**
 * React hook that wraps the Gemini AI description generator.
 *
 * Manages loading, error, and insufficient-data states.
 */
export function useGenerateDescription(
    options: UseGenerateDescriptionHookOptions = {},
): UseGenerateDescriptionReturn {
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
            const check = options.validateFormData
                ? options.validateFormData(formData)
                : getMinimumFieldsPresent(formData);
            if (!check.sufficient) {
                setInsufficientMessage(
                    `Please fill in ${check.missing.join(" and ")} before generating a description.`,
                );
                return null;
            }

            setIsGenerating(true);
            try {
                const description = await generatePropertyDescription(
                    formData,
                    {
                        endpoint: options.endpoint,
                        featureContext: options.featureContext,
                    } satisfies GenerateDescriptionOptions,
                );
                return description;
            } catch (err: unknown) {
                setError(toUserFriendlyError(err));
                return null;
            } finally {
                setIsGenerating(false);
            }
        },
        [options.endpoint, options.featureContext, options.validateFormData],
    );

    return { isEnabled, isGenerating, error, insufficientMessage, generate };
}
