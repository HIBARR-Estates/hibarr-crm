import type { Proposal } from "@/Types/api/proposal";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export type WorkspaceOfferStatus = "draft" | "sent" | "accepted" | "declined";

export interface WorkspaceOfferListItem {
    id: number;
    property: string;
    amountLabel: string;
    status: WorkspaceOfferStatus;
    statusLabel: string;
    statusBadgeVariant: "gray" | "blue" | "green";
    updatedLabel: string;
    sentToLabel: string | null;
    validUntilLabel: string | null;
    notes: string | null;
    canEdit: boolean;
    canSend: boolean;
    proposal: Proposal;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
});

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function resolveOfferStatus(proposal: Proposal): WorkspaceOfferStatus {
    if (proposal.status === "accepted") return "accepted";
    if (proposal.status === "declined") return "declined";
    if (!proposal.send_status) return "draft";
    return "sent";
}

const STATUS_META: Record<
    WorkspaceOfferStatus,
    { label: string; badgeVariant: "gray" | "blue" | "green" }
> = {
    draft: { label: "Draft", badgeVariant: "gray" },
    sent: { label: "Sent", badgeVariant: "blue" },
    accepted: { label: "Accepted", badgeVariant: "green" },
    declined: { label: "Declined", badgeVariant: "gray" },
};

function formatAmount(proposal: Proposal): string {
    const symbol = proposal.currency?.currency_symbol || "£";
    const total = Number(proposal.total ?? 0);
    return `${symbol}${total.toLocaleString("en-GB")}`;
}

function formatProperty(proposal: Proposal): string {
    const description = stripHtml(proposal.description?.trim() || "");
    if (description) return description;
    return proposal.proposal_number || `Offer #${proposal.id}`;
}

export function toWorkspaceOfferListItem(
    proposal: Proposal,
    options: {
        sentToName?: string | null;
        canEdit: boolean;
    },
): WorkspaceOfferListItem {
    const status = resolveOfferStatus(proposal);
    const meta = STATUS_META[status];
    const notes = stripHtml(proposal.note?.trim() || "");

    return {
        id: proposal.id,
        property: formatProperty(proposal),
        amountLabel: formatAmount(proposal),
        status,
        statusLabel: meta.label,
        statusBadgeVariant: meta.badgeVariant,
        updatedLabel: proposal.updated_at
            ? dayjs(proposal.updated_at).fromNow()
            : "Unknown",
        sentToLabel:
            proposal.send_status && options.sentToName
                ? options.sentToName
                : null,
        validUntilLabel: proposal.valid_till
            ? DATE_FORMAT.format(new Date(proposal.valid_till))
            : null,
        notes: notes || null,
        canEdit: options.canEdit,
        canSend: status === "draft" && proposal.status !== "declined",
        proposal,
    };
}
