export type AuditEvent =
    | "created"
    | "updated"
    | "deleted"
    | "restored"
    | "login"
    | "logout"
    | "login_failed"
    | "password_reset";

export type AuditSource = "web" | "api" | "console" | "queue";

export type AuditValues = Record<string, unknown> | null;

export interface AuditLogEntry {
    id: number;
    event: AuditEvent;
    created_at: string | null;
    user: { id: number | null; name: string } | null;
    auditable: {
        type: string;
        type_label: string;
        id: string | null;
        label: string | null;
        url: string | null;
    };
    old_values: AuditValues;
    new_values: AuditValues;
    source: AuditSource | null;
    ip_address: string | null;
    user_agent: string | null;
    http_method: string | null;
    origin: string | null;
}

export interface AuditLogMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface AuditLogFilterOptions {
    users: { id: number; name: string }[];
    types: { value: string; label: string }[];
}

export interface AuditLogFilters {
    /** User ids; 0 is "System" (nobody signed in). */
    users: number[];
    events: AuditEvent[];
    types: string[];
    sources: AuditSource[];
    recordId: string;
    search: string;
    dateFrom: string;
    dateTo: string;
    page: number;
    perPage: number;
}
