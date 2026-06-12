import React, { createContext, useContext, useMemo } from "react";
import { useTranslationContext } from "@/contexts/TranslationContext";
import { dynamicTranslationBatcher } from "@/lib/dynamicTranslation";

interface DynamicTranslationContextValue {
    locale: string;
    batcher: typeof dynamicTranslationBatcher;
}

const DynamicTranslationContext =
    createContext<DynamicTranslationContextValue | null>(null);

export const DynamicTranslationProvider: React.FC<{
    children: React.ReactNode;
    locale?: string;
}> = ({ children, locale: localeOverride }) => {
    const { locale: appLocale } = useTranslationContext();
    const locale = localeOverride ?? appLocale;

    const value = useMemo<DynamicTranslationContextValue>(
        () => ({
            locale,
            batcher: dynamicTranslationBatcher,
        }),
        [locale],
    );

    return (
        <DynamicTranslationContext.Provider value={value}>
            {children}
        </DynamicTranslationContext.Provider>
    );
};

export const useDynamicTranslationContext =
    (): DynamicTranslationContextValue => {
        const context = useContext(DynamicTranslationContext);

        if (!context) {
            throw new Error(
                "useDynamicTranslationContext must be used within DynamicTranslationProvider",
            );
        }

        return context;
    };
