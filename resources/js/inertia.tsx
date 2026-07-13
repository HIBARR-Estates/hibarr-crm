import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { OuterProviders, InnerProviders } from "./providers";
import { route } from "ziggy-js";
import React from "react";
import { initI18n } from "@/lib/i18n";
// import { Ziggy } from "./ziggy";

// Declare global route function
declare global {
    interface Window {
        route: typeof route;
    }
}

window.route = route;

type InertiaPageComponent = React.ComponentType<any> & {
    layout?: (page: React.ReactNode) => React.ReactNode;
};

createInertiaApp({
    // A2: async import so Webpack can emit per-page chunks (requires A1 splitChunks)
    resolve: async (name) => {
        const module = await import(`./Pages/${name}`);
        const component = module.default as InertiaPageComponent;

        // Always wrap with InnerProviders (which need Inertia context)
        // This ensures TranslationProvider has access to usePage()
        const existingLayout = component.layout;
        component.layout = (page: React.ReactNode) => (
            <InnerProviders>
                {existingLayout ? existingLayout(page) : page}
            </InnerProviders>
        );

        return component;
    },
    setup({ App, props, el: og }) {
        // Initialize i18n before first render so react-i18next hooks always have an instance.
        const sharedProps =
            ((props as { initialPage?: { props?: Record<string, unknown> } })
                .initialPage?.props as Record<string, unknown> | undefined) ||
            {};

        const locale = (sharedProps.locale as string) || "en";
        const translations =
            (sharedProps.translations as Record<string, string>) || {};
        const fallbackTranslations =
            (sharedProps.fallbackTranslations as Record<
                string,
                string
            > | null) || null;

        console.log("[i18n] Bootstrap props received", {
            locale,
            translationKeyCount: Object.keys(translations).length,
            hasFallback: fallbackTranslations !== null,
            sampleKey: Object.keys(translations)[0] ?? "none",
            sampleValue: translations[Object.keys(translations)[0]] ?? "none",
        });

        initI18n(locale, translations, fallbackTranslations);

        const el = document.getElementById("app");
        if (!el) {
            return;
        }

        const root = createRoot(el);

        root.render(
            <OuterProviders>
                <App {...props} />
            </OuterProviders>,
        );
    },
});
