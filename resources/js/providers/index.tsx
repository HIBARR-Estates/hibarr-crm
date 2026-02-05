import React from "react";
import ReactQueryProvider from "./react-query/ReactQueryProviders";
import AntdConfigProvider from "./antd/AntdConfigProvider";
import { FilterProvider } from "@/contexts/FilterContext";
import { TranslationProvider } from "@/contexts/TranslationContext";

/**
 * Providers that DON'T require Inertia context (usePage)
 * These wrap around the Inertia <App /> component
 */
export const OuterProviders: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <ReactQueryProvider>
            <AntdConfigProvider>{children}</AntdConfigProvider>
        </ReactQueryProvider>
    );
};

/**
 * Providers that DO require Inertia context (usePage)
 * These must be rendered inside the Inertia <App /> component
 */
export const InnerProviders: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <TranslationProvider>
            <FilterProvider>{children}</FilterProvider>
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
