import { useState } from "react";
import { Skeleton } from "antd";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadContactFile } from "@/Types/api/file";
import type { LeadFinancials } from "../../hooks/useLeadFinancials";
import { formatDate, formatMoney } from "../../adapters/financialFormat";
import { CertaintyChip, StatusBadge, useSourceLabel } from "./FinancialBits";
import FinancialCollectDrawer from "./FinancialCollectDrawer";
import FinancialCompareModal from "./FinancialCompareModal";
import FinancialFinaliseModal from "./FinancialFinaliseModal";
import FinancialHistoryRail from "./FinancialHistoryRail";
import FinancialLineGroups from "./FinancialLineGroups";
import FinancialStatCards from "./FinancialStatCards";

interface FinancialsTabProps {
    financials: LeadFinancials;
    files: LeadContactFile[];
}

const CARD = { background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 12 } as const;

/**
 * The lead page's Financials tab: the current assessment (figures, lines by
 * kind, history), an open draft if there is one, and the guided collection,
 * finalise and compare flows. All data and mutations come from
 * {@link LeadFinancials}; nothing here reloads the page.
 */
export default function FinancialsTab({ financials, files }: FinancialsTabProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const sourceLabel = useSourceLabel();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [finaliseOpen, setFinaliseOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const { data } = financials;

    if (financials.loading || (data === null && !financials.loadFailed)) {
        return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (data === null) {
        return (
            <EmptyState
                role="alert"
                icon="wallet"
                title={t("pages.leads.financials.load_failed_title")}
                description={t("pages.leads.financials.load_failed")}
            />
        );
    }

    const { permissions, summary, current, draft, history, options } = data;
    const crypto = options.crypto_currencies;
    const canEdit = permissions.edit;
    const previous =
        history.find((assessment) => assessment.id === current?.supersedes_assessment_id) ??
        history.find((assessment) => assessment.id !== current?.id) ??
        null;

    const openDrawer = async () => {
        if (!draft) {
            const ok = await financials.startDraft();
            if (!ok) return;
        }
        setDrawerOpen(true);
    };

    const startButton = (label: string) =>
        canEdit ? (
            <Button variant="primary" icon={<Icon name="plus" size={14} />} onClick={() => void openDrawer()} loading={financials.pending === "start"}>
                {label}
            </Button>
        ) : null;

    return (
        <div className="flex flex-col" style={{ gap: 18 }}>
            <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
                <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.TEXT }}>{t("pages.leads.financials.title")}</h2>
                        {current && <StatusBadge status="final" />}
                        {current?.verified_at && (
                            <Badge variant="green">
                                {t("pages.leads.financials.review.verified_badge", {
                                    date: formatDate(current.verified_at),
                                    name: current.verified_by?.name ?? "—",
                                })}
                            </Badge>
                        )}
                    </div>
                    {current && (
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                            {t("pages.leads.financials.meta", {
                                date: formatDate(current.as_of_date),
                                source: sourceLabel(current.source),
                                name: current.prepared_by?.name ?? "—",
                                currency: current.currency,
                            })}
                        </p>
                    )}
                </div>
                {current && !draft && startButton(t("pages.leads.financials.update"))}
            </div>

            {draft && (
                <section style={{ ...CARD, overflow: "hidden", borderColor: T.BLUE_MID }}>
                    <div
                        className="flex flex-wrap items-center"
                        style={{ gap: 12, padding: "14px 18px", background: T.BLUE_WASH, borderBottom: `1px solid ${T.BLUE_MID}` }}
                    >
                        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                            <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t("pages.leads.financials.draft.title")}</h3>
                                <StatusBadge status="draft" />
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.GRAY_DARKER }}>
                                {t("pages.leads.financials.draft.started", {
                                    date: formatDate(draft.as_of_date),
                                    source: sourceLabel(draft.source),
                                    count: draft.lines.length,
                                })}
                            </p>
                        </div>
                        {canEdit && (
                            <>
                                <Button variant="primary" onClick={() => setDrawerOpen(true)}>
                                    {t("pages.leads.financials.draft.continue")}
                                </Button>
                                <Button variant="ghost" onClick={() => setConfirmDiscard(true)} style={{ color: T.RED }}>
                                    {t("pages.leads.financials.drawer.discard")}
                                </Button>
                            </>
                        )}
                    </div>
                    <div style={{ padding: "10px 18px", background: T.AMBER_BG, borderBottom: `1px solid ${T.AMBER_BORDER}`, color: T.AMBER, fontSize: 13 }}>
                        {t("pages.leads.financials.draft.not_counted")}
                    </div>
                    {!current && draft.lines.length > 0 && (
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                            {draft.lines.map((line) => (
                                <li
                                    key={line.id}
                                    className="flex flex-wrap items-center"
                                    style={{ gap: "6px 16px", padding: "11px 18px", borderBottom: `1px solid ${T.BORDER_SOFT}`, fontSize: 14 }}
                                >
                                    <span style={{ flex: "1 1 160px", fontWeight: 500 }}>
                                        {td(line.type_label, { source: "en" })}
                                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: T.TEXT_MUTED }}>{td(line.kind_label, { source: "en" })}</span>
                                    </span>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatMoney(line.amount, line.currency, crypto)}</span>
                                    <CertaintyChip certainty={line.certainty} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {current && summary ? (
                <div className="flex flex-wrap items-start" style={{ gap: 20 }}>
                    <div className="flex flex-col" style={{ flex: "999 1 640px", minWidth: 0, gap: 16 }}>
                        <FinancialStatCards summary={summary} current={current} previous={previous} cryptoCurrencies={crypto} />
                        <FinancialLineGroups assessment={current} previous={previous} kinds={options.kinds} files={files} cryptoCurrencies={crypto} />
                    </div>
                    <div style={{ flex: "1 1 300px", maxWidth: "100%" }}>
                        <FinancialHistoryRail
                            current={current}
                            history={history}
                            cryptoCurrencies={crypto}
                            canEdit={canEdit}
                            verifying={financials.pending === "verify"}
                            updating={financials.pending === "start"}
                            onCompare={() => setCompareOpen(true)}
                            onVerify={() => void financials.verify(current.id)}
                            onUpdate={() => void openDrawer()}
                        />
                    </div>
                </div>
            ) : (
                !draft && (
                    <div style={{ maxWidth: 720 }}>
                        <EmptyState
                            icon="wallet"
                            title={t("pages.leads.financials.empty.title")}
                            description={t("pages.leads.financials.empty.description")}
                            action={canEdit ? { label: t("pages.leads.financials.empty.start"), onClick: () => void openDrawer(), loading: financials.pending === "start" } : undefined}
                        />
                    </div>
                )
            )}

            {draft && (
                <FinancialCollectDrawer
                    open={drawerOpen}
                    financials={financials}
                    draft={draft}
                    workspace={data}
                    files={files}
                    onClose={() => setDrawerOpen(false)}
                    onReview={() => setFinaliseOpen(true)}
                />
            )}
            {draft && (
                <FinancialFinaliseModal
                    open={finaliseOpen}
                    financials={financials}
                    draft={draft}
                    current={current}
                    cryptoCurrencies={crypto}
                    onClose={() => {
                        setFinaliseOpen(false);
                        financials.clearFailure();
                    }}
                    onDone={() => {
                        setFinaliseOpen(false);
                        setDrawerOpen(false);
                    }}
                />
            )}
            <FinancialCompareModal open={compareOpen} onClose={() => setCompareOpen(false)} assessments={history} cryptoCurrencies={crypto} />

            <ConfirmDialog
                open={confirmDiscard}
                title={t("pages.leads.financials.drawer.discard")}
                message={t("pages.leads.financials.drawer.discard_message")}
                confirmLabel={t("pages.leads.financials.drawer.discard")}
                danger
                confirmLoading={financials.pending === "discard"}
                onCancel={() => setConfirmDiscard(false)}
                onConfirm={async () => {
                    await financials.discardDraft();
                    setConfirmDiscard(false);
                }}
            />
        </div>
    );
}
