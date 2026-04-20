import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { OuterProviders, InnerProviders } from "./providers";
import { route } from "ziggy-js";
import React from "react";

declare global {
    interface Window {
        route: typeof route;
    }
}

window.route = route;

createInertiaApp({
    resolve: async (name) => {
        const pages = import.meta.glob("./Pages/**/*.tsx");
        const importPage = pages[`./Pages/${name}.tsx`];

        if (!importPage) {
            throw new Error(`Page not found: ./Pages/${name}.tsx`);
        }

        const module = await importPage();
        const PageComponent = (module as any).default;

        return function InertiaPageWithProviders(props: object) {
            return (
                <InnerProviders>
                    <PageComponent {...props} />
                </InnerProviders>
            );
        };
    },
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <OuterProviders>
                <App {...props} />
            </OuterProviders>,
        );
    },
});

