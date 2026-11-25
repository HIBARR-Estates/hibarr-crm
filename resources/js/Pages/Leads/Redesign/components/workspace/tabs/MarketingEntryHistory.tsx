import { Deferred, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type { LeadEntryRow } from "@/Types/api/leads";
import MarketingSection from "./MarketingSection";

function EntryList() {
    const { t } = useTranslation();
    const { td } = useTd();
    const { leadEntries = [] } = usePage().props as unknown as {
        leadEntries?: LeadEntryRow[];
    };

    if (leadEntries.length === 0) {
        return (
            <p className="v2-mkt-touch-empty">
                {t("pages.leads.marketing.entry_history_empty")}
            </p>
        );
    }

    return (
        <ol className="v2-mkt-touches">
            {leadEntries.map((entry) => (
                <li key={entry.id} className="v2-mkt-touch">
                    <div className="v2-mkt-touch-head">
                        <span className="v2-mkt-touch-date">
                            {formatCompanyDateTime(entry.occurred_at)}
                        </span>
                        <span
                            className={`v2-pill ${entry.is_new_lead ? "v2-pill-blue" : "v2-pill-gray"}`}
                        >
                            {entry.is_new_lead
                                ? t("pages.leads.marketing.entry_new_lead")
                                : t("pages.leads.marketing.entry_returning_lead")}
                        </span>
                    </div>
                    <dl className="v2-mkt-touch-values">
                        <div>
                            <dt>{t("pages.leads.marketing.entry_channel")}</dt>
                            {/* Channel and object names are admin-written English, not UI copy. */}
                            <dd title={entry.channel_path}>
                                {td(entry.channel_name, { source: "en" })}
                            </dd>
                        </div>
                        {entry.source_label && (
                            <div>
                                <dt>{t("pages.leads.marketing.entry_source")}</dt>
                                <dd>{td(entry.source_label, { source: "en" })}</dd>
                            </div>
                        )}
                        {entry.campaign_label && (
                            <div>
                                <dt>{t("pages.leads.marketing.entry_campaign")}</dt>
                                <dd>{entry.campaign_label}</dd>
                            </div>
                        )}
                        {entry.utm_source && (
                            <div>
                                <dt>{t("pages.leads.marketing.utm_source")}</dt>
                                <dd>{entry.utm_source}</dd>
                            </div>
                        )}
                    </dl>
                </li>
            ))}
        </ol>
    );
}

/** Every channel this lead came in through, newest first. Deferred: it never blocks the tab. */
export default function MarketingEntryHistory() {
    const { t } = useTranslation();

    return (
        <MarketingSection
            title={t("pages.leads.marketing.entry_history")}
            icon="arrow-right"
        >
            <div className="v2-mkt-touch-body">
                <Deferred
                    data="leadEntries"
                    fallback={<div className="v2-mkt-touch-skeleton animate-pulse" />}
                >
                    <EntryList />
                </Deferred>
            </div>
        </MarketingSection>
    );
}
