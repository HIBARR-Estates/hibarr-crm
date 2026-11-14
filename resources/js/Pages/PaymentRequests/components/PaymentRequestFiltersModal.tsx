import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { paymentUiStateLabel } from "@/Components/Redesign/adapters/dealPaymentUiState";
import { CheckList, DatePresets, PillGroup, fmt } from "@/Features/Filters/controls";
import "@/Features/Filters/entity-filter-modal.css";
import { formatCompanyDate } from "@/lib/companyDateTime";
import type { DealPaymentUiState } from "@/Types/api/deal-payment";

export interface PaymentRequestFilterOption {
    value: number;
    label: string;
}

export interface PaymentRequestFilterOptions {
    leads: PaymentRequestFilterOption[];
    agents: PaymentRequestFilterOption[];
    currencies: PaymentRequestFilterOption[];
}

export interface PaymentRequestSlice {
    uiState: string;
    dateFrom: string;
    dateTo: string;
    leadIds: number[];
    agentIds: number[];
    currencyIds: number[];
}

interface PaymentRequestFiltersModalProps {
    open: boolean;
    value: PaymentRequestSlice;
    counts?: Partial<Record<"all" | DealPaymentUiState, number>>;
    options?: PaymentRequestFilterOptions;
    onClose: () => void;
    onApply: (next: PaymentRequestSlice) => void;
}

const UI_STATES: DealPaymentUiState[] = [
    "pending_payment",
    "cash_pending",
    "bank_transfer_pending",
    "processing_online",
    "paid_online",
    "confirmed",
    "failed",
    "invalidated",
];

const SECTIONS = ["status", "dates", "lead", "agent", "currency"] as const;

function selectionChip(
    key: string,
    ids: number[],
    choices: PaymentRequestFilterOption[] | undefined,
    clear: () => void,
): { key: string; label: string; clear: () => void } | null {
    if (ids.length === 0) return null;
    const labels = ids.map(
        (id) => choices?.find((choice) => choice.value === id)?.label ?? `#${id}`,
    );
    return { key, label: labels.join(", "), clear };
}

const EMPTY: PaymentRequestSlice = {
    uiState: "",
    dateFrom: "",
    dateTo: "",
    leadIds: [],
    agentIds: [],
    currencyIds: [],
};

/**
 * Same workbench as the lead and deal filter modals: a section rail, the
 * shared date presets, and a tray of what will be applied. Status lives
 * here too — the list no longer has a separate status switcher.
 */
export default function PaymentRequestFiltersModal({
    open,
    value,
    counts,
    options,
    onClose,
    onApply,
}: PaymentRequestFiltersModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [draft, setDraft] = useState<PaymentRequestSlice>(value);
    const [activeSection, setActiveSection] = useState<string>("status");

    useEffect(() => {
        if (!open) return;
        setDraft(value);
        setActiveSection("status");
        // The parent passes a fresh object each render. Reset only when the
        // modal opens, so typing in the draft is not wiped.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const statusLabel = (uiState: DealPaymentUiState) =>
        td(paymentUiStateLabel(uiState), { source: "en" });

    const chips = [
        draft.uiState
            ? {
                  key: "status",
                  label: statusLabel(draft.uiState as DealPaymentUiState),
                  clear: () => setDraft((prev) => ({ ...prev, uiState: "" })),
              }
            : null,
        draft.dateFrom || draft.dateTo
            ? {
                  key: "dates",
                  label: [draft.dateFrom, draft.dateTo]
                      .filter(Boolean)
                      .map((date) => formatCompanyDate(date))
                      .join(" – "),
                  clear: () => setDraft((prev) => ({ ...prev, dateFrom: "", dateTo: "" })),
              }
            : null,
        selectionChip("lead", draft.leadIds, options?.leads, () =>
            setDraft((prev) => ({ ...prev, leadIds: [] })),
        ),
        selectionChip("agent", draft.agentIds, options?.agents, () =>
            setDraft((prev) => ({ ...prev, agentIds: [] })),
        ),
        selectionChip("currency", draft.currencyIds, options?.currencies, () =>
            setDraft((prev) => ({ ...prev, currencyIds: [] })),
        ),
    ].filter((chip): chip is { key: string; label: string; clear: () => void } => chip != null);

    const sectionCount = {
        status: draft.uiState ? 1 : 0,
        dates: draft.dateFrom || draft.dateTo ? 1 : 0,
        lead: draft.leadIds.length,
        agent: draft.agentIds.length,
        currency: draft.currencyIds.length,
    };

    const apply = () => {
        let from = draft.dateFrom;
        let to = draft.dateTo;
        if (from && to && from > to) {
            [from, to] = [to, from];
        }
        onApply({
            uiState: draft.uiState,
            dateFrom: from,
            dateTo: to,
            leadIds: draft.leadIds,
            agentIds: draft.agentIds,
            currencyIds: draft.currencyIds,
        });
    };

    const sectionLabel = (section: (typeof SECTIONS)[number]) => {
        if (section === "status") return t("pages.payment_requests.col_status");
        if (section === "dates") return t("pages.payment_requests.filter_dates");
        if (section === "lead") return t("pages.payment_requests.detail_lead");
        if (section === "agent") return t("pages.payment_requests.detail_agent");
        return t("pages.payment_requests.filter_currency");
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={980}
            footer={null}
            closable={false}
            centered
            destroyOnClose
            className="lfm-modal"
        >
            <div className="lfm">
                <header className="lfm-header">
                    <div>
                        <h2 className="lfm-header__title">{t("pages.payment_requests.filters_title")}</h2>
                        <p className="lfm-header__sub">{t("pages.payment_requests.filters_subtitle")}</p>
                    </div>
                    <div className="lfm-header__actions">
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={() => setDraft(EMPTY)}
                            disabled={chips.length === 0}
                        >
                            {t("pages.payment_requests.filter_clear")}
                        </button>
                        <button type="button" className="lfm-iconbtn" onClick={onClose} aria-label={t("pages.payment_requests.cancel")}>
                            ✕
                        </button>
                    </div>
                </header>

                <div className="lfm-body">
                    <nav className="lfm-rail">
                        {SECTIONS.map((section) => (
                            <button
                                key={section}
                                type="button"
                                className={`lfm-rail__item${activeSection === section ? " is-on" : ""}`}
                                onClick={() => {
                                    setActiveSection(section);
                                    document
                                        .querySelector<HTMLElement>(`[data-section="${section}"]`)
                                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                            >
                                <span>{sectionLabel(section)}</span>
                                {sectionCount[section] > 0 && (
                                    <span className="lfm-rail__badge">{sectionCount[section]}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="lfm-pane">
                        <section data-section="status" className="lfm-section">
                            <h3 className="lfm-section__title">{t("pages.payment_requests.col_status")}</h3>
                            <div className="lfm-pills">
                                <button
                                    type="button"
                                    className={`lfm-pill${!draft.uiState ? " is-on" : ""}`}
                                    onClick={() => setDraft((prev) => ({ ...prev, uiState: "" }))}
                                >
                                    {td("All", { source: "en" })}
                                    {counts?.all != null && (
                                        <span className="lfm-pill__count">{fmt(counts.all)}</span>
                                    )}
                                </button>
                                {UI_STATES.map((uiState) => (
                                    <button
                                        key={uiState}
                                        type="button"
                                        className={`lfm-pill${draft.uiState === uiState ? " is-on" : ""}`}
                                        onClick={() => setDraft((prev) => ({ ...prev, uiState }))}
                                    >
                                        {statusLabel(uiState)}
                                        {counts?.[uiState] != null && (
                                            <span className="lfm-pill__count">{fmt(counts[uiState]!)}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section data-section="dates" className="lfm-section">
                            <div className="lfm-divider" />
                            <h3 className="lfm-section__title">{t("pages.payment_requests.filter_dates")}</h3>
                            <DatePresets
                                start={draft.dateFrom || null}
                                end={draft.dateTo || null}
                                onChange={(start, end) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        dateFrom: start ?? "",
                                        dateTo: end ?? "",
                                    }))
                                }
                            />
                        </section>

                        <OptionSection
                            id="lead"
                            title={t("pages.payment_requests.detail_lead")}
                            choices={options?.leads}
                            emptyLabel={t("pages.payment_requests.filter_none")}
                            loadingLabel={t("pages.payment_requests.filter_loading")}
                        >
                            <CheckList
                                options={options?.leads ?? []}
                                value={draft.leadIds}
                                onChange={(leadIds) =>
                                    setDraft((prev) => ({ ...prev, leadIds: leadIds.map(Number) }))
                                }
                                searchPlaceholder={t("pages.payment_requests.filter_search_leads")}
                            />
                        </OptionSection>

                        <OptionSection
                            id="agent"
                            title={t("pages.payment_requests.detail_agent")}
                            choices={options?.agents}
                            emptyLabel={t("pages.payment_requests.filter_none")}
                            loadingLabel={t("pages.payment_requests.filter_loading")}
                        >
                            <CheckList
                                options={options?.agents ?? []}
                                value={draft.agentIds}
                                onChange={(agentIds) =>
                                    setDraft((prev) => ({ ...prev, agentIds: agentIds.map(Number) }))
                                }
                                searchPlaceholder={t("pages.payment_requests.filter_search_agents")}
                            />
                        </OptionSection>

                        <OptionSection
                            id="currency"
                            title={t("pages.payment_requests.filter_currency")}
                            choices={options?.currencies}
                            emptyLabel={t("pages.payment_requests.filter_none")}
                            loadingLabel={t("pages.payment_requests.filter_loading")}
                        >
                            <PillGroup
                                options={options?.currencies ?? []}
                                value={draft.currencyIds}
                                onChange={(currencyIds) =>
                                    setDraft((prev) => ({ ...prev, currencyIds: currencyIds.map(Number) }))
                                }
                            />
                        </OptionSection>
                    </div>
                </div>

                <footer className="lfm-footer">
                    <div className="lfm-tray">
                        {chips.map((chip) => (
                            <span key={chip.key} className="lfm-tray__chip">
                                {chip.label}
                                <button
                                    type="button"
                                    className="lfm-tray__x"
                                    aria-label={chip.label}
                                    onClick={chip.clear}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                        {chips.length === 0 && (
                            <span className="lfm-tray__empty">
                                {t("pages.payment_requests.filters_subtitle")}
                            </span>
                        )}
                    </div>
                    <div className="lfm-footer__actions">
                        <button type="button" className="lfm-btn lfm-btn--primary" onClick={apply}>
                            {t("pages.payment_requests.filter_apply")}
                        </button>
                    </div>
                </footer>
            </div>
        </Modal>
    );
}

function OptionSection({
    id,
    title,
    choices,
    emptyLabel,
    loadingLabel,
    children,
}: {
    id: string;
    title: string;
    choices?: PaymentRequestFilterOption[];
    emptyLabel: string;
    loadingLabel: string;
    children: ReactNode;
}) {
    return (
        <section data-section={id} className="lfm-section">
            <div className="lfm-divider" />
            <h3 className="lfm-section__title">{title}</h3>
            {choices == null ? (
                <div className="lfm-loading">{loadingLabel}</div>
            ) : choices.length === 0 ? (
                <div className="lfm-empty">{emptyLabel}</div>
            ) : (
                children
            )}
        </section>
    );
}
