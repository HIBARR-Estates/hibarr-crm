import Badge, { type BadgeVariant } from "@/Components/Redesign/primitives/Badge";
import useTranslation from "@/Hooks/useTranslation";
import type { FinCertainty, FinFrequency, FinRole, FinSource, FinStatus } from "./types";

const CERTAINTY_VARIANT: Record<FinCertainty, BadgeVariant> = {
    confirmed: "green",
    likely: "blue",
    uncertain: "amber",
};

/** Confirmed / Likely / Uncertain, coloured and always labelled (never colour alone). */
export function CertaintyChip({ certainty }: { certainty: FinCertainty }) {
    const { t } = useTranslation();
    return <Badge variant={CERTAINTY_VARIANT[certainty]}>{t(`pages.leads.financials.certainties.${certainty}`)}</Badge>;
}

export function StatusBadge({ status }: { status: FinStatus }) {
    const { t } = useTranslation();
    const variant: BadgeVariant = status === "final" ? "green" : status === "draft" ? "blue" : "gray";
    return <Badge variant={variant}>{t(`pages.leads.financials.statuses.${status}`)}</Badge>;
}

export function RoleBadge({ role }: { role: FinRole }) {
    const { t } = useTranslation();
    return <Badge variant="navy">{t(`pages.leads.financials.roles.${role}`)}</Badge>;
}

/** "Monthly", "Once", ... as plain text. */
export function useFrequencyLabel() {
    const { t } = useTranslation();
    return (frequency: FinFrequency) => t(`pages.leads.financials.frequencies.${frequency}`);
}

export function useSourceLabel() {
    const { t } = useTranslation();
    return (source: FinSource) => t(`pages.leads.financials.sources.${source}`);
}
