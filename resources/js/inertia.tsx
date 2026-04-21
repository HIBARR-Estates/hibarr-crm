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

// createInertiaApp({
//     resolve: async (name) => {
//         const pages = import.meta.glob("./Pages/**/*.tsx");
//         const importPage = pages[`./Pages/${name}.tsx`];
//         if (!importPage) {
//             throw new Error(`❌ Page not found: ./Pages/${name}.tsx`);
//         }
//         const module = await importPage();
//         return (module as any).default;
//     },
//     setup({ el, App, props }) {
//         const root = createRoot(el);
//         root.render(
//             <Providers>
//                 <App {...props} />
//             </Providers>,
//         );
//     },
// });

createInertiaApp({
    resolve: (name) => {
        try {
            // console.log(
            //     "Attempting to load page:",
            //     name,
            //     "from URL:",
            //     window.location.href
            // );
            const component = require(`./Pages/${name}`).default;
            // console.log("Successfully loaded component:", component);

            // Always wrap with InnerProviders (which need Inertia context)
            // This ensures TranslationProvider has access to usePage()
            const existingLayout = component.layout;
            component.layout = (page: React.ReactNode) => (
                <InnerProviders>
                    {existingLayout ? existingLayout(page) : page}
                </InnerProviders>
            );

            return component;
        } catch (e) {
            // console.error("Could not load page:", name, e);
            // console.error(
            //     "Full error details:",
            //     e instanceof Error ? e.message : "Unknown error",
            //     e instanceof Error ? e.stack : ""
            // );
            throw e;
        }
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
