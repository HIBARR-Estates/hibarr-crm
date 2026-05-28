import React from "react";
import ReactQueryProvider from "./react-query/ReactQueryProviders";
import AntdConfigProvider from "./antd/AntdConfigProvider";
import { FilterProvider } from "@/contexts/FilterContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";

/**
 * Providers that DON'T require Inertia context (usePage)
 * These wrap around the Inertia <App /> component
 */
export const OuterProviders: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
};

/**
 * Providers that DO require Inertia context (usePage)
 * These must be rendered inside the Inertia <App /> component
 * Note: AntdConfigProvider uses usePage() for locale/RTL settings
 */
export const InnerProviders: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <TranslationProvider>
            <DynamicTranslationProvider>
                <AntdConfigProvider>
                    <FilterProvider>{children}</FilterProvider>
                </AntdConfigProvider>
            </DynamicTranslationProvider>
        </TranslationProvider>
    );
};

/**
 * @deprecated Use OuterProviders and InnerProviders separately
 * This is kept for backward compatibility but may cause issues
 * with providers that use usePage() outside Inertia context
 */
export const Providers: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <OuterProviders>
            <InnerProviders>{children}</InnerProviders>
        </OuterProviders>
    );
};
