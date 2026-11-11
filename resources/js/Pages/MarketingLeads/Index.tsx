import { useState, type ReactNode } from "react";
import { Head } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import MarketingLeadModal from "@/Features/Leads/MarketingIntake/MarketingLeadModal";
import type { SavedMarketingLead } from "@/Features/Leads/MarketingIntake/types";
import useTranslation from "@/Hooks/useTranslation";

/**
 * Landing page for the marketing lead flow, so members of the assigned
 * departments reach it even without the leads list. The modal opens at once.
 */
export default function MarketingLeadsIndex({ pageTitle }: { pageTitle: string }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(true);
    const [saved, setSaved] = useState<SavedMarketingLead[]>([]);

    return (
        <PageLayout breadcrumbs={[{ name: pageTitle }]}>
            <Head title={pageTitle} />
            <div
                className="mx-auto flex w-full max-w-3xl flex-col"
                style={{ padding: "8px 0 32px", fontFamily: REDESIGN_FONT_STACK, gap: 20 }}
            >
                <div>
                    <h1 style={{ margin: 0, fontSize: REDESIGN_TYPE.DISPLAY, fontWeight: 700, color: T.NAVY }}>
                        {t("pages.marketing_leads.page_title")}
                    </h1>
                    <p style={{ margin: "6px 0 0", fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED, lineHeight: 1.45, maxWidth: 560 }}>
                        {t("pages.marketing_leads.page_intro")}
                    </p>
                </div>
                <div>
                    <Button variant="primary" icon={<Icon name="plus" size={14} />} onClick={() => setOpen(true)}>
                        {t("pages.marketing_leads.open_button")}
                    </Button>
                </div>
                {saved.length > 0 && (
                    <div style={{ background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                        <div
                            style={{
                                padding: "12px 16px",
                                borderBottom: `1px solid ${T.BORDER}`,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {t("pages.marketing_leads.added_this_session_count", { count: saved.length })}
                        </div>
                        {saved.map((lead) => (
                            <a
                                key={lead.id}
                                href={lead.url}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "11px 16px",
                                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    color: T.TEXT,
                                    textDecoration: "none",
                                    fontSize: 14,
                                }}
                            >
                                <b style={{ fontWeight: 600 }}>{lead.client_name}</b>
                                <span style={{ color: T.TEXT_MUTED }}>{lead.client_email || t("pages.marketing_leads.no_email")}</span>
                            </a>
                        ))}
                    </div>
                )}
            </div>
            <MarketingLeadModal
                open={open}
                onClose={() => setOpen(false)}
                onSaved={(lead) => setSaved((prev) => [lead, ...prev])}
            />
        </PageLayout>
    );
}

MarketingLeadsIndex.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
