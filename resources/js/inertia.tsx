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

// require.context is a Webpack-specific feature and not available here.
// If using Vite or another bundler, dynamic imports will work without this.
// You can safely remove this line.
window.route = route;

const pages = import.meta.glob<{ default: React.ComponentType & { layout?: (page: React.ReactNode) => React.ReactNode } }>(
    "./Pages/**/*.tsx",
);

const INNER_PROVIDERS_WRAPPED = Symbol.for("inertia.innerProvidersWrapped");

createInertiaApp({
    resolve: async (name) => {
        const importPage = pages[`./Pages/${name}.tsx`];
        if (!importPage) {
            throw new Error(`Page not found: ./Pages/${name}.tsx`);
        }

        const module = await importPage();
        const component = module.default;

        if (!(component as Record<symbol, boolean>)[INNER_PROVIDERS_WRAPPED]) {
            const existingLayout = component.layout;
            component.layout = (page: React.ReactNode) => (
                <InnerProviders>
                    {existingLayout ? existingLayout(page) : page}
                </InnerProviders>
            );
            (component as Record<symbol, boolean>)[INNER_PROVIDERS_WRAPPED] = true;
        }

        return component;
    },
    setup({ App, props, el: og }) {
        // console.log("Setting up Inertia app with element:", og);
        // console.log("App props:", props);

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

        // if (!el) {
        //     console.error('No element found with id "app"');
        //     return;
        // }
        const el = document.getElementById("app");
        if (!el) {
            // console.error("❌ Could not find #app element");
            return;
        }

        const root = createRoot(el);
        // console.log("Creating React root and rendering...");

        root.render(
            <OuterProviders>
                <App {...props} />
            </OuterProviders>,
        );
        // console.log("React app rendered successfully");
    },
});
