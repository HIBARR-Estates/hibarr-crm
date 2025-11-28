import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { Providers } from "./providers";

// Declare global route function
declare global {
    interface Window {
        route: (name: string, params?: any, absolute?: boolean) => string;
    }
}

// require.context is a Webpack-specific feature and not available here.
// If using Vite or another bundler, dynamic imports will work without this.
// You can safely remove this line.

// console.log("Inertia app starting...");

// Simple route helper for development
window.route = function (name: string, params?: any, absolute?: boolean) {
    // console.log("Route called:", name, params);
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

        // Dashboard routes
        dashboard: "/account/dashboard",
        "dashboard.advanced": "/account/dashboard-advanced",

        // Calendar routes
        "my-calendar.index": "/account/my-calendar",

        // Lead/Deal routes
        "lead-contact.index": "/account/lead-contact",
        "lead-contact.create": "/account/lead-contact/create",
        "lead-contact.show": "/account/lead-contact/{id}",
        "lead-contact.edit": "/account/lead-contact/{id}/edit",
        "lead-contact.store": "/account/lead-contact",
        "lead-contact.update": "/account/lead-contact/{id}",
        "lead-contact.patch": "/account/lead-contact/{id}",
        "lead-contact.destroy": "/account/lead-contact/{id}",
        "lead-contact.import": "/account/lead-contact/import",
        "lead-contact.import.store": "/account/lead-contact/import",
        "lead-contact.import.process": "/account/lead-contact/import/process",
        "lead-contact.sample_import": "/account/lead-contact/sample-import",
        "lead-contact.apply_quick_action":
            "/account/lead-contact/apply-quick-action",
        "leadboards.index": "/account/leadboards",
        "leadboards.create": "/account/leadboards/create",
        "leadboards.show": "/account/leadboards/{id}",
        "leadboards.edit": "/account/leadboards/{id}/edit",
        "leadboards.store": "/account/leadboards",
        "leadboards.update": "/account/leadboards/{id}",
        "leadboards.destroy": "/account/leadboards/{id}",
        "leadboards.get_stage_slug": "/account/leadboards/get-stage-slug",
        "leadboards.collapse_column": "/account/leadboards/collapseColumn",
        "leadboards.update_index": "/account/leadboards/updateIndex",
        "leadboards.load_more": "/account/leadboards/loadMore",

        // Lead Stage Settings routes
        "lead-stage-setting.index": "/account/settings/lead-stage-setting",
        "lead-stage-setting.create":
            "/account/settings/lead-stage-setting/create",
        "lead-stage-setting.show": "/account/settings/lead-stage-setting/{id}",
        "lead-stage-setting.edit":
            "/account/settings/lead-stage-setting/{id}/edit",
        "lead-stage-setting.store": "/account/settings/lead-stage-setting",
        "lead-stage-setting.update":
            "/account/settings/lead-stage-setting/{id}",
        "lead-stage-setting.destroy":
            "/account/settings/lead-stage-setting/{id}",
        "lead-stage-setting.stageUpdate":
            "/account/settings/lead-stage-update/{statusId}",

        // Deal routes
        "deals.get-stage": "/account/deals/get-stage/{id}",
        "deals.index": "/account/deals",
        "deals.create": "/account/deals/create",
        "deals.show": "/account/deals/{id}",
        "deals.edit": "/account/deals/{id}/edit",
        "deals.store": "/account/deals",
        "deals.update": "/account/deals/{id}",
        "deals.patch": "/account/deals/{id}",
        "deals.destroy": "/account/deals/{id}",
        "deals.apply_quick_action": "/account/deals/apply-quick-action",
        "deals.import": "/account/deals/import",
        "deals.import.store": "/account/deals/import",
        "deals.import.process": "/account/deals/import/process",
        "deals.sample_import": "/account/deals/sample-import",
        "deals.export": "/account/deals/export",
        "deals.follow_up": "/account/deals/follow-up/{leadID}",
        "deals.follow_up_store": "/account/deals/follow-up-store",
        "deals.follow_up_edit": "/account/deals/follow-up-edit/{id}",
        "deals.follow_up_update": "/account/deals/follow-up-update",
        "deals.follow_up_delete": "/account/deals/follow-up-delete/{id}",
        "deals.follow_up_apply_quick_action":
            "/account/deals/follow-up-apply-quick-action",

        // Meeting Types routes
        "meeting-types.index": "/account/meeting-types",
        "meeting-types.create": "/account/meeting-types/create",
        "meeting-types.show": "/account/meeting-types/{id}",
        "meeting-types.edit": "/account/meeting-types/{id}/edit",
        "meeting-types.store": "/account/meeting-types",
        "meeting-types.update": "/account/meeting-types/{id}",
        "meeting-types.destroy": "/account/meeting-types/{id}",

        // Deal Notes routes
        "deal-notes.index": "/account/deal-notes",
        "deal-notes.create": "/account/deal-notes/create",
        "deal-notes.show": "/account/deal-notes/{id}",
        "deal-notes.edit": "/account/deal-notes/{id}/edit",
        "deal-notes.store": "/account/deal-notes",
        "deal-notes.update": "/account/deal-notes/{id}",
        "deal-notes.destroy": "/account/deal-notes/{id}",
        "deal-notes.apply_quick_action":
            "/account/deal-notes/apply-quick-action",

        // Lead Notes routes
        "lead-notes.index": "/account/lead-notes",
        "lead-notes.create": "/account/lead-notes/create",
        "lead-notes.show": "/account/lead-notes/{id}",
        "lead-notes.edit": "/account/lead-notes/{id}/edit",
        "lead-notes.store": "/account/lead-notes",
        "lead-notes.update": "/account/lead-notes/{id}",
        "lead-notes.destroy": "/account/lead-notes/{id}",
        "lead-notes.ask_for_password":
            "/account/lead-notes/ask-for-password/{id}",
        "lead-notes.check_password": "/account/lead-notes/check-password",
        "lead-notes.apply_quick_action":
            "/account/lead-notes/apply-quick-action",

        // Deal Files routes
        "deal-files.index": "/account/deal-files",
        "deal-files.create": "/account/deal-files/create",
        "deal-files.show": "/account/deal-files/{id}",
        "deal-files.edit": "/account/deal-files/{id}/edit",
        "deal-files.store": "/account/deal-files",
        "deal-files.update": "/account/deal-files/{id}",
        "deal-files.destroy": "/account/deal-files/{id}",
        "deal-files.download": "/account/deal-files/download/{id}",
        "deal-files.layout": "/account/deal-files/layout",

        // Communication Activities routes
        "api.communication-activities.store.internal":
            "/api/v1/internal/communication-activities",
        "api.deals.communication-activities.internal":
            "/api/v1/internal/deals/{dealId}/communication-activities",

        // Proposals routes
        "proposals.index": "/account/proposals",
        "proposals.create": "/account/proposals/create",
        "proposals.show": "/account/proposals/{id}",
        "proposals.edit": "/account/proposals/{id}/edit",
        "proposals.store": "/account/proposals",
        "proposals.update": "/account/proposals/{id}",
        "proposals.destroy": "/account/proposals/{id}",
        "proposals.delete_image": "/account/proposals/delete-image",
        "proposals.download": "/account/proposals/download/{id}",
        "proposals.send_proposal": "/account/proposals/send-proposal/{id}",
        "proposals.add_item": "/account/proposals/add-item",

        // Front routes (public routes)
        "front.proposal": "/proposal/{hash}",

        // Client routes
        "clients.index": "/account/clients",
        "clients.create": "/account/clients/create",
        "clients.show": "/account/clients/{id}",
        "clients.edit": "/account/clients/{id}/edit",
        "clients.store": "/account/clients",
        "clients.update": "/account/clients/{id}",
        "clients.destroy": "/account/clients/{id}",
        "clients.approve": "/account/clients/approve/{id}",
        "clients.save_consent_purpose_data":
            "/account/clients/save-consent-purpose-data/{client}",
        "clients.gdpr_consent": "/account/clients/gdpr-consent",
        "clients.save_client_consent":
            "/account/clients/save-client-consent/{lead}",
        "clients.ajax_details": "/account/clients/ajax-details/{id}",
        "clients.client_details": "/account/clients/client-details/{id}",
        "clients.project_list": "/account/clients/project-list/{id}",
        "clients.apply_quick_action": "/account/clients/apply-quick-action",
        "clients.import": "/account/clients/import",
        "clients.import.store": "/account/clients/import",
        "clients.import.process": "/account/clients/import/process",

        // HR routes
        "employees.index": "/account/employees",
        "leaves.index": "/account/leaves",
        "attendances.index": "/account/attendances",
        "holidays.index": "/account/holidays",

        // Work routes
        "contracts.index": "/account/contracts",
        "projects.index": "/account/projects",
        "tasks.index": "/account/tasks",
        "timelogs.index": "/account/timelogs",

        // Finance routes
        "estimates.index": "/account/estimates",
        "invoices.index": "/account/invoices",
        "payments.index": "/account/payments",

        // Product routes
        "products.index": "/account/products",

        // Settings routes
        "company-settings.index": "/account/company-settings",
        "profile-settings.index": "/account/profile-settings",

        // Auth routes
        logout: "/logout",

        // Resource routes follow standard Laravel resource pattern
        // Employees
        "employees.create": "/account/employees/create",
        "employees.show": "/account/employees/{id}",
        "employees.edit": "/account/employees/{id}/edit",
        "employees.store": "/account/employees",
        "employees.update": "/account/employees/{id}",
        "employees.destroy": "/account/employees/{id}",

        // Projects
        "projects.create": "/account/projects/create",
        "projects.show": "/account/projects/{id}",
        "projects.edit": "/account/projects/{id}/edit",
        "projects.store": "/account/projects",
        "projects.update": "/account/projects/{id}",
        "projects.destroy": "/account/projects/{id}",

        // Tasks
        "tasks.create": "/account/tasks/create",
        "tasks.show": "/account/tasks/{id}",
        "tasks.edit": "/account/tasks/{id}/edit",
        "tasks.store": "/account/tasks",
        "tasks.update": "/account/tasks/{id}",
        "tasks.destroy": "/account/tasks/{id}",
        "tasks.apply_quick_action": "/account/tasks/apply-quick-action",
        "tasks.change_status": "/account/tasks/change-status",
        "tasks.change_milestone": "/account/tasks/milestone-change",

        // Products
        "products.create": "/account/products/create",
        "products.show": "/account/products/{id}",
        "products.edit": "/account/products/{id}/edit",
        "products.store": "/account/products",
        "products.update": "/account/products/{id}",
        "products.destroy": "/account/products/{id}",

        // Invoices
        "invoices.create": "/account/invoices/create",
        "invoices.show": "/account/invoices/{id}",
        "invoices.edit": "/account/invoices/{id}/edit",
        "invoices.store": "/account/invoices",
        "invoices.update": "/account/invoices/{id}",
        "invoices.destroy": "/account/invoices/{id}",

        // Estimates
        "estimates.create": "/account/estimates/create",
        "estimates.show": "/account/estimates/{id}",
        "estimates.edit": "/account/estimates/{id}/edit",
        "estimates.store": "/account/estimates",
        "estimates.update": "/account/estimates/{id}",
        "estimates.destroy": "/account/estimates/{id}",

        // Leaves
        "leaves.create": "/account/leaves/create",
        "leaves.show": "/account/leaves/{id}",
        "leaves.edit": "/account/leaves/{id}/edit",
        "leaves.store": "/account/leaves",
        "leaves.update": "/account/leaves/{id}",
        "leaves.destroy": "/account/leaves/{id}",

        //TODO: Add more routes as needed from web.php
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
    resolve: async (name) => {
        const pages = import.meta.glob("./Pages/**/*.tsx");
        const importPage = pages[`./Pages/${name}.tsx`];
        if (!importPage) {
            throw new Error(`❌ Page not found: ./Pages/${name}.tsx`);
        }
        const module = await importPage();
        return (module as any).default;
    },
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <Providers>
                <App {...props} />
            </Providers>
        );
    },
});

// createInertiaApp({
//     resolve: (name) => {
//         try {
//             // console.log(
//             //     "Attempting to load page:",
//             //     name,
//             //     "from URL:",
//             //     window.location.href
//             // );
//             const component = require(`./Pages/${name}`).default;
//             // console.log("Successfully loaded component:", component);
//             return component;
//         } catch (e) {
//             // console.error("Could not load page:", name, e);
//             // console.error(
//             //     "Full error details:",
//             //     e instanceof Error ? e.message : "Unknown error",
//             //     e instanceof Error ? e.stack : ""
//             // );
//             throw e;
//         }
//     },
//     setup({ App, props, el: og }) {
//         // console.log("Setting up Inertia app with element:", og);
//         // console.log("App props:", props);

//         // if (!el) {
//         //     console.error('No element found with id "app"');
//         //     return;
//         // }
//         const el = document.getElementById("app");
//         if (!el) {
//             // console.error("❌ Could not find #app element");
//             return;
//         }

//         const root = createRoot(el);
//         // console.log("Creating React root and rendering...");
//         root.render(
//             <Providers>
//                 <App {...props} />
//             </Providers>
//         );
//         // console.log("React app rendered successfully");
//     },
// });
