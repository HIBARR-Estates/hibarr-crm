import type { BadgeVariant } from "@/Components/Redesign/primitives/Badge";
import type { AuditEvent, AuditSource } from "../types";

/** Badge colour + glyph per action. Labels live in `app.auditLog.events.*`. */
export const AUDIT_EVENT_STYLE: Record<AuditEvent, { variant: BadgeVariant; icon: string }> = {
    created: { variant: "green", icon: "plus" },
    updated: { variant: "blue", icon: "edit" },
    deleted: { variant: "red", icon: "trash" },
    restored: { variant: "teal", icon: "refresh" },
    login: { variant: "navy", icon: "lock" },
    logout: { variant: "gray", icon: "lock" },
    login_failed: { variant: "amber", icon: "ban" },
    password_reset: { variant: "amber", icon: "lock" },
};

/** Events that change a record's fields (and so carry a before/after diff). */
export const RECORD_EVENTS: AuditEvent[] = ["created", "updated", "deleted", "restored"];

export const AUDIT_SOURCE_ICON: Record<AuditSource, string> = {
    web: "grid",
    api: "zap",
    console: "list",
    queue: "clock",
};

export const DEFAULT_PER_PAGE = 25;
