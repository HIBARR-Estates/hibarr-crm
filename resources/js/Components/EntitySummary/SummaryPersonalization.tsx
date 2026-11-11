import {
    createContext,
    useCallback,
    useContext,
    type ReactNode,
} from "react";
import {
    personalizeSummaryText,
    type SummaryTokenValues,
} from "./summaryTokens";

const SummaryPersonalizationContext = createContext<SummaryTokenValues>({});

interface SummaryPersonalizationProviderProps {
    values: SummaryTokenValues;
    children: ReactNode;
}

/** Makes the lead's token values available to every part of a summary card. */
export function SummaryPersonalizationProvider({
    values,
    children,
}: SummaryPersonalizationProviderProps) {
    return (
        <SummaryPersonalizationContext.Provider value={values}>
            {children}
        </SummaryPersonalizationContext.Provider>
    );
}

/**
 * Returns the function that fills tokens into AI text. Call it on text that has already
 * been through `td()`, never before it (see summaryTokens.ts). Without a provider (deal
 * summaries) there are no values, so a stray token still never shows as raw braces.
 */
export function usePersonalize(): (text: string) => string {
    const values = useContext(SummaryPersonalizationContext);

    return useCallback(
        (text: string) => personalizeSummaryText(text, values),
        [values],
    );
}
