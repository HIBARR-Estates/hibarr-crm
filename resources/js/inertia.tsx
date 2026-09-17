import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { OuterProviders, InnerProviders } from "./providers";
import { route } from "ziggy-js";
import React from "react";
import { initI18n, loadI18n } from "@/lib/i18n";
import { initAnalytics } from "@/lib/analytics";
import {
    loadPageModule,
    type InertiaPageComponent,
} from "@inertia-load-page";
// import { Ziggy } from "./ziggy";

// Declare global route function
declare global {
    interface Window {
        route: typeof route;
    }
}

window.route = route;

createInertiaApp({
    resolve: async (name) => {
        const module = await loadPageModule(name);
        const component = module.default;

        // Always wrap with InnerProviders (which need Inertia context)
        // This ensures TranslationProvider has access to usePage()
        //
        // Guarded: `module.default` is the same cached object on every visit to
        // this page, but resolve() itself runs on every visit — without the
        // guard, re-visiting a page nests another InnerProviders layer each
        // time, which duplicates everything mounted inside it (notification
        // bridge, meeting-attendance poller, ...).
        if (!component.__wrappedWithInnerProviders) {
            const existingLayout = component.layout;
            component.layout = (page: React.ReactNode) => (
                <InnerProviders>
                    {existingLayout ? existingLayout(page) : page}
                </InnerProviders>
            );
            component.__wrappedWithInnerProviders = true;
        }

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
