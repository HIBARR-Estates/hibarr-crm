import { createContext, useContext, type ReactNode } from "react";

/**
 * What the New activity panel says it is for: who, which deal (when one is
 * selected) and the company's real meeting types. The record pages provide
 * it once so every New activity button on the page reads the same.
 */
export interface NewActivityScope {
    person: string;
    deal: string | null;
    meetingTypes: string[];
}

const NewActivityContext = createContext<NewActivityScope | null>(null);

export function NewActivityProvider({ value, children }: { value: NewActivityScope; children: ReactNode }) {
    return <NewActivityContext.Provider value={value}>{children}</NewActivityContext.Provider>;
}

export function useNewActivityScope(): NewActivityScope | null {
    return useContext(NewActivityContext);
}
