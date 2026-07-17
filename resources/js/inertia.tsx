import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { OuterProviders, InnerProviders } from "./providers";
import { route } from "ziggy-js";
import React from "react";
import { initI18n, loadI18n } from "@/lib/i18n";
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
        const sharedProps =
            ((props as { initialPage?: { props?: Record<string, unknown> } })
                .initialPage?.props as Record<string, unknown> | undefined) ||
            {};

        const locale = (sharedProps.locale as string) || "en";

        const el = document.getElementById("app");
        if (!el) {
            return;
        }

        const root = createRoot(el);

        const mount = () => {
            root.render(
                <OuterProviders>
                    <App {...props} />
                </OuterProviders>,
            );
        };

        // Load dictionaries from dedicated endpoint before first paint.
        loadI18n(locale)
            .catch(() => {
                // Degrade gracefully; TranslationProvider may retry on mount.
                initI18n(locale, {}, null);
            })
            .finally(mount);
    },
});