import { Deferred, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type { LeadUtmTouch } from "@/Types/api/leads";
import MarketingSection from "./MarketingSection";

const UTM_FIELDS = [
    ["utm_source", "pages.leads.marketing.utm_source"],
    ["utm_medium", "pages.leads.marketing.utm_medium"],
    ["utm_campaign", "pages.leads.marketing.utm_campaign"],
    ["utm_content", "pages.leads.marketing.utm_content"],
    ["utm_term", "pages.leads.marketing.utm_term"],
    ["utm_audience", "pages.leads.marketing.utm_audience"],
] as const;

const KNOWN_ORIGINS = ["api", "bitrix_import", "deal_import", "backfill"];

function TouchHistoryList() {
    const { t } = useTranslation();
    const { utmTouches = [] } = usePage().props as unknown as {
        utmTouches?: LeadUtmTouch[];
    };

    // The first touch is already shown above; the history is only interesting
    // once something arrived after it.
    if (utmTouches.length <= 1) {
        return (
            <p className="v2-mkt-touch-empty">
                {t("pages.leads.marketing.touch_history_empty")}
            </p>
        );
    }

    return (
        <ol className="v2-mkt-touches">
            {utmTouches.map((touch, index) => {
                const values = UTM_FIELDS.filter(
                    ([field]) => !!touch[field],
                );
                const origin = touch.origin
                    ? KNOWN_ORIGINS.includes(touch.origin)
                        ? t(
                              `pages.leads.marketing.touch_origin_${touch.origin}`,
                          )
                        : touch.origin
                    : null;

                return (
                    <li key={touch.id} className="v2-mkt-touch">
                        <div className="v2-mkt-touch-head">
                            <span className="v2-mkt-touch-date">
                                {formatCompanyDateTime(touch.created_at)}
                            </span>
                            {touch.is_first_touch && (
                                <span className="v2-pill v2-pill-blue">
                                    {t("pages.leads.marketing.touch_first")}
                                </span>
                            )}
                            {index === 0 && !touch.is_first_touch && (
                                <span className="v2-pill v2-pill-green">
                                    {t("pages.leads.marketing.touch_latest")}
                                </span>
                            )}
                            {origin && (
                                <span className="v2-pill v2-pill-gray">
                                    {t("pages.leads.marketing.touch_origin")}:{" "}
                                    {origin}
                                </span>
                            )}
                        </div>
                        <dl className="v2-mkt-touch-values">
                            {values.map(([field, labelKey]) => (
                                <div key={field}>
                                    <dt>{t(labelKey)}</dt>
                                    <dd>{touch[field]}</dd>
                                </div>
                            ))}
                        </dl>
                    </li>
                );
            })}
        </ol>
    );
}

export default function MarketingTouchHistory() {
    const { t } = useTranslation();

    return (
        <MarketingSection
            title={t("pages.leads.marketing.touch_history")}
            icon="activity"
        >
            <div className="v2-mkt-touch-body">
                <Deferred
                    data="utmTouches"
                    fallback={<div className="v2-mkt-touch-skeleton animate-pulse" />}
                >
                    <TouchHistoryList />
                </Deferred>
            </div>
        </MarketingSection>
    );
}
