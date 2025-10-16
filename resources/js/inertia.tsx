import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { Providers } from "./providers";

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
        "properties.apply_quick_action":
            "/account/properties/apply-quick-action",
        "properties.bulk_action": "/account/properties/bulk-action",
        "properties.import": "/account/properties/import",
        "properties.import.store": "/account/properties/import",
        "properties.import.process": "/account/properties/import-process",
        "properties.sample_import": "/account/properties/sample-import",
        "properties.export": "/account/properties/export",
        "properties.configurations": "/account/properties/configurations",
        "properties.allowed_types": "/account/properties/allowed-types",
        "properties.allowed_fields": "/account/properties/allowed-fields",
        "properties.update_photos": "/account/properties/{id}/photos",
        "properties.add_single_photo": "/account/properties/{id}/photos/add",
        "properties.update_single_photo":
            "/account/properties/{id}/photos/{index}",
        "properties.delete_single_photo":
            "/account/properties/{id}/photos/single",
        "properties.update_video": "/account/properties/{id}/video",
        "properties.update_360_tour": "/account/properties/{id}/360-tour",
        "properties.delete_assets": "/account/properties/{id}/assets",
        //TODO: Refer to web.php and update this list
        // Add more routes as needed
    };

    let url = routes[name] || `/${name}`;

    // Enhanced parameter replacement
    if (params) {
        if (typeof params === "object" && !Array.isArray(params)) {
            // Handle object parameters
            for (const [key, value] of Object.entries(params)) {
                url = url.replace(`{${key}}`, String(value));
            }
        } else if (Array.isArray(params)) {
            // Handle array parameters (for routes with multiple params like update_single_photo)
            params.forEach((value, index) => {
                if (index === 0) {
                    url = url.replace("{id}", String(value));
                } else if (index === 1) {
                    url = url.replace("{index}", String(value));
                }
            });
        } else {
            // Handle single parameter (backward compatibility)
            url = url.replace("{id}", String(params));
        }
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
        root.render(
            <Providers>
                <App {...props} />
            </Providers>
        );
        console.log("React app rendered successfully");
    },
});
