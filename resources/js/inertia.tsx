import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { OuterProviders, InnerProviders } from "./providers";
import { route } from "ziggy-js";
import React from "react";
import { initI18n, loadI18n } from "@/lib/i18n";
import { initAnalytics } from "@/lib/analytics";
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

// Vite can only code-split a dynamic import when the path is statically
// analyzable — a template literal like `./Pages/${name}` isn't, so it needs
// this glob form instead (the officially supported pattern for Inertia).
const pageModules = import.meta.glob<{ default: InertiaPageComponent }>(
    "./Pages/**/*.tsx",
);

createInertiaApp({
    resolve: async (name) => {
        const path = `./Pages/${name}.tsx`;
        const importPage = pageModules[path];
        if (!importPage) {
            throw new Error(`Page not found: ${path}`);
        }
        const module = await importPage();
        const component = module.default;

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
        const initialPage = (
            props as { initialPage?: { component?: string; url?: string; props?: Record<string, unknown> } }
        ).initialPage;

        const sharedProps =
            (initialPage?.props as Record<string, unknown> | undefined) || {};

        const locale = (sharedProps.locale as string) || "en";

        // No-op unless a PostHog key is configured server-side. Started here
        // rather than in a provider so it also covers pages that never mount
        // the dashboard layout, and cannot re-fire on re-render.
        initAnalytics(initialPage ?? {});

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
