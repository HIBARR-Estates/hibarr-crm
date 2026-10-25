/**
 * Entry gates for the Access inspector's "This page" filter.
 *
 * Keyed by the Inertia component name (`usePage().component`).
 * Only what must hold for the screen to load belongs here: a permission
 * (and the scopes that pass, when the controller allow-lists them) and
 * feature flags that abort or 404 the page.
 *
 * Leave out record-level checks, modules, roles, and flags that only
 * show a tab, widget, or redesign variant. A key with an empty entry
 * means the page was reviewed and nothing in the flag or permission
 * catalogs gates it. A missing key means the page is not catalogued yet.
 */

export type PagePermissionGate = {
    key: string;
    /** Scopes that pass the controller check. Omitted = any grant except none. */
    scopes?: string[];
};

export type PageAccessEntry = {
    /** Default "all": every listed permission is required. "any": one is enough. */
    permissionsMatch?: "all" | "any";
    permissions?: PagePermissionGate[];
    /** Every listed flag is required to load the page. */
    flags?: string[];
};

const EMPTY: PageAccessEntry = {};

const view = (key: string): PagePermissionGate => ({ key });

const scopeAll = (key: string): PagePermissionGate => ({
    key,
    scopes: ["all"],
});

const addScopes = (key: string): PagePermissionGate => ({
    key,
    scopes: ["all", "added"],
});

export const PAGE_ACCESS: Record<string, PageAccessEntry> = {
    "Deals/Index": EMPTY,
    "Deals/Show": { permissions: [view("view_deals")] },
    "Deals/Create": { permissions: [addScopes("add_deals")] },

    "Leads/Index": { permissions: [view("view_lead")] },
    "Leads/Show": { permissions: [view("view_lead")] },
    "Leads/Create": { permissions: [addScopes("add_lead")] },

    "Tasks/Index": { permissions: [view("view_tasks")] },
    "Tasks/Show": { permissions: [view("view_tasks")] },

    "Meetings/Index": EMPTY,

    "Dashboard/V2/PersonalDashboard": {
        flags: ["crm.personal-dashboard"],
    },
    "Dashboard/V2/DashboardV2": {
        permissionsMatch: "any",
        permissions: [
            scopeAll("view_manager_dashboard"),
            scopeAll("view_team_dashboard"),
            scopeAll("view_leadership_dashboard"),
            scopeAll("view_partner_dashboard"),
        ],
    },
    "Dashboard/ComprehensiveDashboard": EMPTY,

    "Settings/Index": EMPTY,
    "Settings/Preferences": EMPTY,
    "Settings/ReminderPreferences": EMPTY,
    "Settings/Leads/Index": { permissions: [scopeAll("manage_lead_setting")] },
    "Settings/CustomFields/Index": {
        permissions: [scopeAll("manage_custom_field_setting")],
    },
    "Settings/NotificationSettings": {
        permissions: [scopeAll("manage_notification_setting")],
    },
    "Settings/Packages/Index": {
        permissions: [scopeAll("manage_company_setting")],
    },
    "Settings/MeetingAttendanceConfirmationSettings": {
        permissions: [scopeAll("manage_company_setting")],
    },
    "Settings/AnalysisScriptBuilder": {
        permissions: [scopeAll("manage_lead_setting")],
    },
    "Settings/Automation/Index": {
        permissions: [scopeAll("manage_company_setting")],
        flags: ["crm.automation-v2"],
    },
    "Settings/Mailbox": { flags: ["crm.email"] },
};

/** Declared entry for this Inertia component, or undefined when uncatalogued. */
export function pageAccessFor(
    component: string | undefined,
): PageAccessEntry | undefined {
    if (!component || !Object.prototype.hasOwnProperty.call(PAGE_ACCESS, component)) {
        return undefined;
    }

    return PAGE_ACCESS[component];
}
