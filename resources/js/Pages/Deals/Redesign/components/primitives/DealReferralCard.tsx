import { useEffect, useState, type CSSProperties } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type {
    DealReferralBreakdown,
    DealReferralTerm,
    ReferralCommissionType,
} from "@/Types/api/deals";
import DealMoneyInput from "./DealMoneyInput";

type OverrideMode = "inherit" | "percentage" | "amount" | "excluded";

export interface ReferralOverrideInput {
    referral_commission_type: ReferralCommissionType | null;
    referral_commission_value: number | null;
}

interface DealReferralCardProps {
    referral: DealReferralBreakdown;
    /** The deal's value in company currency, the base a percentage override is taken from. */
    dealValue: number;
    currencySymbol: string;
    editable: boolean;
    saving: boolean;
    onSave: (input: ReferralOverrideInput) => Promise<void>;
}

const MODE_BY_TYPE: Record<ReferralCommissionType, OverrideMode> = {
    percentage: "percentage",
    fixed: "amount",
    none: "excluded",
};

// Both columns hold two decimals; compare what the server will store.
const round2 = (value: number) => Math.round(value * 100) / 100;

const parse = (text: string): number | null => {
    const trimmed = text.trim();
    if (trimmed === "") return null;
    const number = Number(trimmed);
    return Number.isNaN(number) ? null : round2(number);
};

const toText = (value: number | null) => (value == null ? "" : String(value));

/**
 * The referral part of the deal value popup: what the referrer is paid and on
 * what terms, and, when the deal is still editable, this deal's own terms.
 *
 * The popup grows with this card rather than scrolling, so every block sits in
 * one column with a fixed gap between blocks and a smaller one inside them.
 */
export default function DealReferralCard({
    referral,
    dealValue,
    currencySymbol,
    editable,
    saving,
    onSave,
}: DealReferralCardProps) {
    const { t } = useTranslation();
    const name = referral.referrer_name;
    const saved = referral.override;
    const savedMode: OverrideMode = saved.type ? MODE_BY_TYPE[saved.type] : "inherit";
    const savedPercent = saved.type === "percentage" ? saved.value : null;
    const savedAmount = saved.type === "fixed" ? saved.value : null;

    const [mode, setMode] = useState<OverrideMode>(savedMode);
    const [percent, setPercent] = useState(toText(savedPercent));
    const [amount, setAmount] = useState(toText(savedAmount));
    const [pasteRejected, setPasteRejected] = useState(false);

    // Only a changed saved value resets the drafts, so a failed save keeps what was typed.
    useEffect(() => {
        setMode(savedMode);
        setPercent(toText(savedPercent));
        setAmount(toText(savedAmount));
    }, [savedMode, savedPercent, savedAmount]);

    const formatMoney = (value: number) =>
        `${currencySymbol}${Number(value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const percentValue = parse(percent);
    const amountValue = parse(amount);
    const percentInvalid = percentValue !== null && percentValue > 100;
    const draftAmount =
        mode === "percentage" && percentValue !== null && !percentInvalid
            ? round2((dealValue * percentValue) / 100)
            : mode === "amount"
              ? amountValue
              : null;
    const tooHigh = draftAmount !== null && draftAmount > referral.max_amount;

    const dirty =
        mode === "inherit"
            ? savedMode !== "inherit"
            : mode === "excluded"
              ? savedMode !== "excluded"
              : mode === "percentage"
                ? percentValue !== null &&
                  !percentInvalid &&
                  !tooHigh &&
                  (savedMode !== "percentage" || percentValue !== savedPercent)
                : amountValue !== null &&
                  amountValue > 0 &&
                  !tooHigh &&
                  (savedMode !== "amount" || amountValue !== savedAmount);

    const payload = (): ReferralOverrideInput => {
        if (mode === "percentage") {
            return { referral_commission_type: "percentage", referral_commission_value: percentValue };
        }
        if (mode === "amount") {
            return { referral_commission_type: "fixed", referral_commission_value: amountValue };
        }
        if (mode === "excluded") {
            return { referral_commission_type: "none", referral_commission_value: null };
        }
        return { referral_commission_type: null, referral_commission_value: null };
    };

    const sourceLabel = (term: DealReferralTerm) => {
        if (term.package_name) return term.package_name;
        if (term.source === "deal") return t("pages.deals.info.value_insight.referral_source_deal");
        if (term.source === "partner") return t("pages.deals.info.value_insight.referral_source_partner");
        return t("pages.deals.info.value_insight.referral_source_recorded");
    };

    // A settled deal shows only what was paid: the rules may have changed since.
    const ruleLabel = (term: DealReferralTerm): string | null => {
        if (term.type === null) return null;
        if (term.type === "none") return t("pages.deals.info.value_insight.referral_rule_none");
        if (term.type === "fixed") return t("pages.deals.info.value_insight.referral_rule_fixed");
        return t(
            term.source === "package"
                ? "pages.deals.info.value_insight.referral_rule_percent_package"
                : "pages.deals.info.value_insight.referral_rule_percent_deal",
            { rate: term.value },
        );
    };

    const small = (color: string): CSSProperties => ({
        fontSize: 12,
        lineHeight: 1.5,
        color,
    });

    const hint = (text: string, color: string = T.TEXT_MUTED) => <span style={small(color)}>{text}</span>;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: 14,
                marginBottom: 12,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                background: T.SURFACE_2,
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                    {t("pages.deals.info.value_insight.referral_title", { name })}
                </span>
                {hint(t("pages.deals.info.value_insight.referral_scope", { name }))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {referral.terms.length === 0
                    ? hint(
                          referral.settled
                              ? t("pages.deals.info.value_insight.referral_none_paid")
                              : t("pages.deals.info.value_insight.referral_no_terms", { name }),
                      )
                    : referral.terms.map((term, index) => {
                          const rule = ruleLabel(term);

                          return (
                              <div
                                  key={`${term.source}-${term.package_id ?? "deal"}-${index}`}
                                  style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      justifyContent: "space-between",
                                      gap: 12,
                                  }}
                              >
                                  <div
                                      style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 2,
                                          minWidth: 0,
                                      }}
                                  >
                                      <span
                                          style={{
                                              fontSize: 13,
                                              fontWeight: 500,
                                              color: T.TEXT,
                                              overflowWrap: "anywhere",
                                          }}
                                      >
                                          {sourceLabel(term)}
                                      </span>
                                      {rule && hint(rule)}
                                  </div>
                                  <span
                                      style={{
                                          fontSize: 13,
                                          fontWeight: 600,
                                          color: T.TEXT,
                                          whiteSpace: "nowrap",
                                          fontVariantNumeric: "tabular-nums",
                                      }}
                                  >
                                      {formatMoney(term.amount)}
                                  </span>
                              </div>
                          );
                      })}
            </div>

            {referral.terms.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        paddingTop: 12,
                        borderTop: `1px dashed ${T.BORDER}`,
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                        {t("pages.deals.info.value_insight.referral_total")}
                    </span>
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: T.TEXT,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {formatMoney(referral.paid_total)}
                    </span>
                </div>
            )}

            {referral.capped && hint(t("pages.deals.info.value_insight.referral_capped"))}
            {referral.settled && hint(t("pages.deals.info.value_insight.referral_recorded"))}

            {editable && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        paddingTop: 14,
                        borderTop: `1px solid ${T.BORDER}`,
                    }}
                >
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.TEXT_HINT }}>
                        {t("pages.deals.info.value_insight.referral_override_label")}
                    </span>

                    <Segmented<OverrideMode>
                        fullWidth
                        ariaLabel={t("pages.deals.info.value_insight.referral_override_label")}
                        value={mode}
                        onChange={(next) => {
                            if (!saving) setMode(next);
                        }}
                        options={[
                            {
                                value: "inherit",
                                label: t("pages.deals.info.value_insight.referral_mode_inherit"),
                            },
                            {
                                value: "percentage",
                                label: t("pages.deals.info.value_insight.referral_mode_percent"),
                            },
                            {
                                value: "amount",
                                label: t("pages.deals.info.value_insight.referral_mode_amount"),
                            },
                            {
                                value: "excluded",
                                label: t("pages.deals.info.value_insight.referral_mode_excluded"),
                            },
                        ]}
                    />

                    {mode === "inherit" && hint(t("pages.deals.info.value_insight.referral_inherit_hint"))}

                    {mode === "percentage" && (
                        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {hint(t("pages.deals.info.value_insight.referral_percent_of_deal"), T.TEXT_HINT)}
                            <DealMoneyInput
                                prefix="%"
                                value={percent}
                                disabled={saving}
                                ariaLabel={t("pages.deals.info.value_insight.referral_percent_of_deal")}
                                onChange={setPercent}
                            />
                            {percentInvalid &&
                                hint(t("pages.deals.info.value_insight.referral_percent_invalid"), T.RED)}
                        </label>
                    )}

                    {mode === "amount" && (
                        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {hint(t("pages.deals.info.value_insight.referral_agreed"), T.TEXT_HINT)}
                            <DealMoneyInput
                                prefix={currencySymbol}
                                value={amount}
                                disabled={saving}
                                ariaLabel={t("pages.deals.info.value_insight.referral_agreed")}
                                onChange={(next) => {
                                    setPasteRejected(false);
                                    setAmount(next);
                                }}
                                onInvalidPaste={() => setPasteRejected(true)}
                            />
                            {pasteRejected &&
                                hint(t("pages.deals.info.value_insight.referral_amount_unreadable"), T.RED)}
                        </label>
                    )}

                    {mode === "excluded" &&
                        hint(t("pages.deals.info.value_insight.referral_excluded", { name }))}

                    {tooHigh &&
                        hint(
                            t("pages.deals.info.value_insight.referral_too_high", {
                                max: formatMoney(referral.max_amount),
                            }),
                            T.RED,
                        )}

                    {dirty && (
                        <Button
                            variant="navy"
                            size="sm"
                            disabled={saving}
                            onClick={() => onSave(payload())}
                        >
                            {t("pages.deals.info.value_insight.referral_save")}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
