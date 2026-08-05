import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { EmptyState, Icon } from "@/Components/Redesign";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";

type MarketingField =
    | { kind: "text"; labelKey: string; value: string | null | undefined }
    | { kind: "bool"; labelKey: string; value: boolean }
    | { kind: "score"; labelKey: string; value: number | null | undefined }
    | { kind: "date"; labelKey: string; value: string | null | undefined };

interface MarketingSection {
    titleKey: string;
    icon: string;
    fields: MarketingField[];
}

function FieldRow({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="v2-mkt-row">
            <span className="v2-mkt-label">{label}</span>
            <span className="v2-mkt-value">{children}</span>
        </div>
    );
}

function BoolPill({ value, yes, no }: { value: boolean; yes: string; no: string }) {
    return (
        <span className={`v2-pill ${value ? "v2-pill-green" : "v2-pill-gray"}`}>
            {value ? yes : no}
        </span>
    );
}

function displayText(value: string | null | undefined): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : "—";
}

export default function MarketingTab() {
    const { t } = useTranslation();
    const { lead } = useLeadWorkspace();
    const marketing = lead.marketing;

    if (!marketing) {
        return <EmptyState title={t("pages.leads.marketing.empty")} />;
    }

    const yes = t("pages.leads.marketing.yes");
    const no = t("pages.leads.marketing.no");

    const sections: MarketingSection[] = [
        {
            titleKey: "pages.leads.marketing.utm_section",
            icon: "target",
            fields: [
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.utm_source",
                    value: marketing.utm_source,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.utm_medium",
                    value: marketing.utm_medium,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.utm_campaign",
                    value: marketing.utm_campaign,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.utm_content",
                    value: marketing.utm_content,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.utm_term",
                    value: marketing.utm_term,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.utm_audience",
                    value: marketing.utm_audience,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.traffic_source_id",
                    value: marketing.traffic_source_id,
                },
            ],
        },
        {
            titleKey: "pages.leads.marketing.social_section",
            icon: "users",
            fields: [
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.facebook_click_id",
                    value: marketing.facebook_click_id,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.facebook_lead_id",
                    value: marketing.facebook_lead_id,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.facebook_browser_id",
                    value: marketing.facebook_browser_id,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.ip_address",
                    value: marketing.ip_address,
                },
                {
                    kind: "text",
                    labelKey: "pages.leads.marketing.user_agent",
                    value: marketing.user_agent,
                },
            ],
        },
        {
            titleKey: "pages.leads.marketing.engagement_section",
            icon: "activity",
            fields: [
                {
                    kind: "score",
                    labelKey: "pages.leads.marketing.contact_score",
                    value: marketing.contact_score,
                },
                {
                    kind: "date",
                    labelKey: "pages.leads.marketing.last_webinar_date",
                    value: marketing.last_webinar_date,
                },
                {
                    kind: "bool",
                    labelKey: "pages.leads.marketing.registered_for_webinar",
                    value: marketing.has_registered_for_the_webinar,
                },
                {
                    kind: "bool",
                    labelKey: "pages.leads.marketing.attended_webinar",
                    value: marketing.has_attended_the_webinar,
                },
                {
                    kind: "bool",
                    labelKey: "pages.leads.marketing.joined_facebook_group",
                    value: marketing.has_joined_the_facebook_group,
                },
                {
                    kind: "bool",
                    labelKey: "pages.leads.marketing.joined_whatsapp_group",
                    value: marketing.has_joined_the_whatsapp_group,
                },
                {
                    kind: "bool",
                    labelKey: "pages.leads.marketing.downloaded_ebook",
                    value: marketing.has_downloaded_the_ebook,
                },
                {
                    kind: "bool",
                    labelKey: "pages.leads.marketing.registered_for_zoom",
                    value: marketing.registered_for_zoom_meeting,
                },
            ],
        },
    ];

    return (
        <div className="v2-mkt">
            {sections.map((section) => (
                <section key={section.titleKey} className="v2-mkt-section">
                    <header className="v2-mkt-section-head">
                        <Icon name={section.icon} size={14} />
                        <span>{t(section.titleKey)}</span>
                    </header>
                    <div className="v2-mkt-grid">
                        {section.fields.map((field) => {
                            const label = t(field.labelKey);
                            if (field.kind === "bool") {
                                return (
                                    <FieldRow key={field.labelKey} label={label}>
                                        <BoolPill
                                            value={field.value}
                                            yes={yes}
                                            no={no}
                                        />
                                    </FieldRow>
                                );
                            }
                            if (field.kind === "score") {
                                return (
                                    <FieldRow key={field.labelKey} label={label}>
                                        <span className="v2-pill v2-pill-blue">
                                            {field.value ?? 0}
                                        </span>
                                    </FieldRow>
                                );
                            }
                            if (field.kind === "date") {
                                return (
                                    <FieldRow key={field.labelKey} label={label}>
                                        {field.value
                                            ? formatCompanyDate(field.value)
                                            : "—"}
                                    </FieldRow>
                                );
                            }
                            return (
                                <FieldRow key={field.labelKey} label={label}>
                                    <span
                                        className={
                                            field.labelKey.includes("user_agent")
                                                ? "break-all text-[12px]"
                                                : undefined
                                        }
                                        title={field.value ?? undefined}
                                    >
                                        {displayText(field.value)}
                                    </span>
                                </FieldRow>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
