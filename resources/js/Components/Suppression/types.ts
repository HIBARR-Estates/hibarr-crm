export type SuppressionChannel =
    | "email"
    | "whatsapp"
    | "sms"
    | "telegram"
    | "instagram"
    | "call";

export type SuppressionScope = "non_transactional" | "transactional" | "all";

export type SuppressionEntityType = "lead" | "deal";

export interface SuppressionRestriction {
    uuid: string;
    channel: SuppressionChannel;
    scope: SuppressionScope;
    reason: string;
    source: string;
    author: string | null;
    createdAt: string;
    expiresAt: string | null;
    applyToFutureDetails: boolean;
    email?: string | null;
    phone?: string | null;
}

export interface BlockedChannelSummary {
    channel: SuppressionChannel;
    scope: SuppressionScope;
    applyToFutureDetails: boolean;
    email?: string | null;
    phone?: string | null;
}

export interface SuppressionRestrictionsResponse {
    unavailable: boolean;
    canViewDetails: boolean;
    restrictions: SuppressionRestriction[];
    blockedChannels: BlockedChannelSummary[];
}

export interface SuppressionPermissions {
    canViewDetails: boolean;
    canBlock: boolean;
    canLift: boolean;
    canLiftRestricted: boolean;
    canViewFull: boolean;
}

export interface SuppressionContactTarget {
    label: string;
    type: "email" | "phone";
    value: string;
}

export interface ChannelBlockEvaluation {
    blocked: boolean;
    warningOnly: boolean;
    unavailable: boolean;
    canViewDetails: boolean;
    reason: string | null;
    scope: SuppressionScope | null;
    entries: SuppressionRestriction[];
}
