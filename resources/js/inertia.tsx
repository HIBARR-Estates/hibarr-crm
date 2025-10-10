import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import React from "react";

// require.context is a Webpack-specific feature and not available here.
// If using Vite or another bundler, dynamic imports will work without this.
// You can safely remove this line.

console.log("Inertia app starting...");

// Simple route helper for development
window.route = function (name: string, params?: any, absolute?: boolean) {
    console.log("Route called:", name, params);
    const routes: Record<string, string> = {
        "properties.index": "/account/properties",
        "properties.create": "/account/properties/create",
        "properties.show": "/account/properties/{id}",
        "properties.edit": "/account/properties/{id}/edit",
        "properties.store": "/account/properties",
        "properties.update": "/account/properties/{id}",
        "properties.destroy": "/account/properties/{id}",
    };

    let url = routes[name] || `/${name}`;

    // Simple parameter replacement
    if (params && typeof params === "object") {
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`{${key}}`, String(value));
        }
    } else if (params) {
        url = url.replace("{id}", String(params));
    }

    return absolute ? `${window.location.origin}${url}` : url;
};

createInertiaApp({
    resolve: (name) => {
        try {
            console.log(
                "Attempting to load page:",
                name,
                "from URL:",
                window.location.href
            );
            const component = require(`./Pages/${name}`).default;
            console.log("Successfully loaded component:", component);
            return component;
        } catch (e) {
            console.error("Could not load page:", name, e);
            console.error(
                "Full error details:",
                e instanceof Error ? e.message : "Unknown error",
                e instanceof Error ? e.stack : ""
            );
            throw e;
        }
    },
    setup({ App, props, el: og }) {
        console.log("Setting up Inertia app with element:", og);
        console.log("App props:", props);

        // if (!el) {
        //     console.error('No element found with id "app"');
        //     return;
        // }
        const el = document.getElementById("app");
        if (!el) {
            console.error("❌ Could not find #app element");
            return;
        }

        const root = createRoot(el);
        console.log("Creating React root and rendering...");
        root.render(<App {...props} />);
        console.log("React app rendered successfully");
    },
});
