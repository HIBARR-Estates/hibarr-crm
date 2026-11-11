import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import type { LeadMarketing } from "@/Types/api/leads";
import SectionCard, { SectionEmpty } from "./SectionCard";

interface Row {
    label: string;
    value: string;
}

/**
 * Where the person came from: campaign and source, then what they have done
 * (webinar, ebook, groups). Only recorded values are listed, from the same
 * marketing record as the lead page's Marketing tab.
 */
export default function MarketingSection({ marketing }: { marketing: LeadMarketing | null | undefined }) {
    const { t } = useTranslation();
    const { formatDate } = useUserDateTime();
    const k = (key: string) => t(`pages.leads.marketing.${key}`);

    const rows: Row[] = [];
    const text = (key: string, value: string | number | null | undefined) => {
        const trimmed = value === null || value === undefined ? "" : String(value).trim();
        if (trimmed) rows.push({ label: k(key), value: trimmed });
    };
    const flag = (key: string, value: boolean | undefined) => {
        if (value) rows.push({ label: k(key), value: k("yes") });
    };

    if (marketing) {
        text("utm_source", marketing.utm_source);
        text("utm_medium", marketing.utm_medium);
        text("utm_campaign", marketing.utm_campaign);
        text("utm_content", marketing.utm_content);
        text("utm_term", marketing.utm_term);
        text("utm_audience", marketing.utm_audience);
        text("contact_score", marketing.contact_score);
        text("last_webinar_date", marketing.last_webinar_date ? formatDate(marketing.last_webinar_date) : "");
        flag("registered_for_webinar", marketing.has_registered_for_the_webinar);
        flag("attended_webinar", marketing.has_attended_the_webinar);
        flag("downloaded_ebook", marketing.has_downloaded_the_ebook);
        flag("joined_facebook_group", marketing.has_joined_the_facebook_group);
        flag("joined_whatsapp_group", marketing.has_joined_the_whatsapp_group);
        flag("registered_for_zoom", marketing.registered_for_zoom_meeting);
    }

    return (
        <SectionCard id="deal-marketing" title={t("pages.agent_workspace.deal.marketing.title")}>
            {rows.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.marketing.empty")}</SectionEmpty>
            ) : (
                <dl className="agent-deal__facts">
                    {rows.map((row) => (
                        <div key={row.label} className="agent-deal__fact">
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </SectionCard>
    );
}
