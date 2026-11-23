import type {
    BlockedChannelSummary,
    ChannelBlockEvaluation,
    SuppressionChannel,
    SuppressionContactTarget,
    SuppressionRestriction,
    SuppressionScope,
} from "./types";

const RECIPIENT_OPT_OUT_SOURCES = new Set([
    "unsubscribe_link",
    "preference_page",
    "stop_keyword",
]);

const RESTRICTED_REASONS = new Set(["complained", "do_not_call"]);

export function isRecipientOptOut(
    entry: Pick<SuppressionRestriction, "source">,
): boolean {
    return RECIPIENT_OPT_OUT_SOURCES.has(entry.source);
}

export function isRestrictedSuppression(
    entry: Pick<SuppressionRestriction, "source" | "reason" | "channel">,
): boolean {
    return (
        isRecipientOptOut(entry) ||
        RESTRICTED_REASONS.has(entry.reason) ||
        entry.channel === "call"
    );
}

function normalizeHandle(value: string | null | undefined, channel: SuppressionChannel): string {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return "";
    if (channel === "email") {
        return trimmed.toLowerCase();
    }
    return trimmed.replace(/[^\d+]/g, "");
}

function entryMatchesHandle(
    entry: {
        email?: string | null;
        phone?: string | null;
        applyToFutureDetails?: boolean;
    },
    channel: SuppressionChannel,
    handle?: string | null,
): boolean {
    if (entry.applyToFutureDetails) {
        return true;
    }

    const normalized = normalizeHandle(handle, channel);
    if (!normalized) {
        return true;
    }

    const candidate =
        channel === "email"
            ? normalizeHandle(entry.email, channel)
            : normalizeHandle(entry.phone, channel);

    if (!candidate) {
        // Masked handle (`a***@ex***`) cannot be compared by exact equality, so
        // treat channel-level match on the entity as applicable when masked.
        return false;
    }

    if (candidate.includes("***")) {
        return true;
    }

    return candidate === normalized;
}

function scopeCoversAction(
    entryScope: SuppressionScope,
    requestedScope: SuppressionScope,
): boolean {
    if (entryScope === "all") return true;
    return entryScope === requestedScope;
}

export function evaluateChannelBlock(params: {
    restrictions: SuppressionRestriction[];
    blockedChannels: BlockedChannelSummary[];
    unavailable: boolean;
    canViewDetails: boolean;
    channel: SuppressionChannel;
    scope?: SuppressionScope;
    handle?: string | null;
}): ChannelBlockEvaluation {
    const {
        restrictions,
        blockedChannels,
        unavailable,
        canViewDetails,
        channel,
        scope = "transactional",
        handle,
    } = params;

    const matchingDetailed = restrictions.filter(
        (entry) =>
            entry.channel === channel &&
            entryMatchesHandle(entry, channel, handle),
    );

    const matchingSummaries = blockedChannels.filter(
        (entry) =>
            entry.channel === channel &&
            entryMatchesHandle(entry, channel, handle),
    );

    const blockingDetailed = matchingDetailed.filter((entry) =>
        scopeCoversAction(entry.scope, scope),
    );
    const blockingSummaries = matchingSummaries.filter((entry) =>
        scopeCoversAction(entry.scope, scope),
    );

    const isBlocked =
        blockingDetailed.length > 0 || blockingSummaries.length > 0;

    if (isBlocked) {
        const primary = blockingDetailed[0] ?? null;
        const primarySummary = blockingSummaries[0] ?? null;
        return {
            blocked: true,
            warningOnly: false,
            unavailable,
            canViewDetails,
            reason: canViewDetails ? (primary?.reason ?? null) : null,
            scope: primary?.scope ?? primarySummary?.scope ?? scope,
            entries: blockingDetailed,
        };
    }

    // SUP-D03: a non_transactional email block does not stop a 1:1 email,
    // but warns the agent before composing so newsletter-like sends are flagged.
    const nonTransactionalOnly =
        channel === "email" &&
        scope === "transactional" &&
        (matchingDetailed.some((entry) => entry.scope === "non_transactional") ||
            matchingSummaries.some(
                (entry) => entry.scope === "non_transactional",
            ));

    if (nonTransactionalOnly) {
        const primary = matchingDetailed.find(
            (entry) => entry.scope === "non_transactional",
        );
        return {
            blocked: false,
            warningOnly: true,
            unavailable,
            canViewDetails,
            reason: canViewDetails ? (primary?.reason ?? null) : null,
            scope: "non_transactional",
            entries: matchingDetailed,
        };
    }

    return {
        blocked: false,
        warningOnly: false,
        unavailable,
        canViewDetails,
        reason: null,
        scope: null,
        entries: [],
    };
}

export function extractLeadSuppressionTargets(lead: {
    client_email?: string | null;
    mobile?: unknown;
    cell?: string | null;
    office?: string | null;
    client_whatsapp?: unknown;
    contact_methods?: Array<{ type: string; identifier: string }>;
} | null | undefined): SuppressionContactTarget[] {
    if (!lead) return [];

    const targets: SuppressionContactTarget[] = [];
    const seen = new Set<string>();

    const addTarget = (
        label: string,
        type: "email" | "phone",
        raw: unknown,
    ) => {
        let value = "";
        if (typeof raw === "string") {
            value = raw.trim();
        } else if (raw && typeof raw === "object") {
            const obj = raw as { phone?: string; identifier?: string };
            value = (obj.phone ?? obj.identifier ?? "").trim();
        }
        if (!value) return;
        const key = `${type}:${type === "email" ? value.toLowerCase() : value}`;
        if (seen.has(key)) return;
        seen.add(key);
        targets.push({ label, type, value });
    };

    addTarget("Email", "email", lead.client_email);
    addTarget("Mobile", "phone", lead.mobile);
    addTarget("Phone", "phone", lead.cell);
    addTarget("Office", "phone", lead.office);
    addTarget("WhatsApp", "phone", lead.client_whatsapp);

    for (const method of lead.contact_methods ?? []) {
        addTarget(
            method.type === "email" ? "Email" : "Phone",
            method.type === "email" ? "email" : "phone",
            method.identifier,
        );
    }

    return targets;
}
