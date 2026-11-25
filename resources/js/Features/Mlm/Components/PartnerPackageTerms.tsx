import { useMemo, useState } from "react";
import { message } from "antd";
import {
    Button,
    CommissionRuleFields,
    EMPTY_COMMISSION_RULE,
    isRuleComplete,
    ruleForSave,
    type CommissionRuleDraft,
} from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { getFirstValidationMessage } from "@/lib/api/utils/common";
import {
    usePartnerPackageTerms,
    useRemovePartnerPackageTerms,
    useSavePartnerPackageTerms,
} from "../api";
import type { PartnerPackageTermsRow, ReferralCommissionType } from "../types";

interface PartnerPackageTermsProps {
    agentId: number;
    /** The company currency symbol: fixed amounts pay out in it. */
    currencySymbol: string;
}

const inputClass =
    "h-9 rounded-lg border border-[#e2e5ea] bg-white px-3 text-sm text-[#1a1f2e] outline-none focus:border-[#1a6bb5]";

/**
 * Everything one partner earns on packages, seen from the partner's side: a row
 * per package with what they earn as its closer and as its referrer, and an
 * editor to add or change one. It reads and writes the same rows the package
 * settings screen edits, so the two always agree.
 *
 * It renders no frame of its own, so the agent dashboard and the partner modal
 * can each place it in their own card.
 */
export default function PartnerPackageTerms({ agentId, currencySymbol }: PartnerPackageTermsProps) {
    const { t } = useTranslation();
    const query = usePartnerPackageTerms(agentId);
    const save = useSavePartnerPackageTerms(agentId);
    const remove = useRemovePartnerPackageTerms(agentId);

    const [packageId, setPackageId] = useState<number | null>(null);
    const [closer, setCloser] = useState<CommissionRuleDraft>(EMPTY_COMMISSION_RULE);
    const [referral, setReferral] = useState<CommissionRuleDraft>(EMPTY_COMMISSION_RULE);

    const rows = useMemo(() => query.data?.data.rows ?? [], [query.data]);
    const packages = useMemo(() => query.data?.data.packages ?? [], [query.data]);

    const assigned = useMemo(() => new Set(rows.map((row) => row.package_id)), [rows]);
    const editing = packageId !== null && assigned.has(packageId);
    // A package the partner already has terms on stays selectable only while it
    // is being edited, so its row is changed rather than duplicated.
    const selectable = packages.filter((pkg) => !assigned.has(pkg.id) || pkg.id === packageId);

    const money = (amount: number) =>
        `${currencySymbol}${amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const describe = (
        type: ReferralCommissionType | null,
        value: number | null,
        unset: string,
    ): string => {
        if (!type) return unset;
        if (type === "none" || value === null) return t("pages.agents.package_terms_no_commission");
        return type === "percentage" ? `${value}%` : money(value);
    };

    const reset = () => {
        setPackageId(null);
        setCloser(EMPTY_COMMISSION_RULE);
        setReferral(EMPTY_COMMISSION_RULE);
    };

    const edit = (row: PartnerPackageTermsRow) => {
        setPackageId(row.package_id);
        setCloser({ type: row.commission_type, value: row.commission_value });
        setReferral({ type: row.referral_commission_type, value: row.referral_commission_value });
    };

    const hasTerms = closer.type !== null || referral.type !== null;
    const canSave = packageId !== null && hasTerms && isRuleComplete(closer) && isRuleComplete(referral);
    const busy = save.isPending || remove.isPending;

    const onSave = async () => {
        if (!canSave || packageId === null) return;
        const closerRule = ruleForSave(closer);
        const referralRule = ruleForSave(referral);

        try {
            await save.mutateAsync({
                packageId,
                terms: {
                    commission_type: closerRule.type,
                    commission_value: closerRule.value,
                    referral_commission_type: referralRule.type,
                    referral_commission_value: referralRule.value,
                },
            });
            message.success(t("pages.agents.package_terms_saved"));
            reset();
        } catch (error) {
            message.error(getFirstValidationMessage(error, t("pages.agents.package_terms_save_failed")));
        }
    };

    const onRemove = async (row: PartnerPackageTermsRow) => {
        try {
            await remove.mutateAsync(row.package_id);
            if (packageId === row.package_id) reset();
        } catch (error) {
            message.error(getFirstValidationMessage(error, t("pages.agents.package_terms_save_failed")));
        }
    };

    if (query.isLoading) {
        return (
            <div className="flex flex-col gap-2" aria-busy="true">
                <div className="h-14 animate-pulse rounded-lg bg-[#f1f3f6]" />
                <div className="h-14 animate-pulse rounded-lg bg-[#f1f3f6]" />
            </div>
        );
    }

    if (query.isError) {
        return (
            <p role="alert" className="text-sm text-[#b91c1c]">
                {t("pages.agents.package_terms_load_failed")}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {rows.length === 0 ? (
                <p className="text-sm text-[#5b6472]">{t("pages.agents.package_terms_empty")}</p>
            ) : (
                <div className="divide-y divide-[#eef0f3] overflow-hidden rounded-lg border border-[#e2e5ea] bg-white">
                    {rows.map((row) => (
                        <div
                            key={row.package_id}
                            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 py-3"
                        >
                            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                                <span className="text-sm font-medium text-[#1a1f2e]">
                                    {row.package_name}
                                </span>
                                <span className="text-xs text-[#9ca3af]">
                                    {t("pages.agents.package_terms_package_value", {
                                        value: money(row.package_value),
                                    })}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1 text-sm text-[#5b6472]">
                                <span>
                                    {t("pages.agents.package_terms_as_closer")}{" "}
                                    <span className="font-semibold text-[#16294d]">
                                        {describe(
                                            row.commission_type,
                                            row.commission_value,
                                            t("pages.agents.package_terms_package_default"),
                                        )}
                                    </span>
                                </span>
                                <span>
                                    {t("pages.agents.package_terms_as_referrer")}{" "}
                                    <span className="font-semibold text-[#16294d]">
                                        {describe(
                                            row.referral_commission_type,
                                            row.referral_commission_value,
                                            t("pages.agents.package_terms_not_set"),
                                        )}
                                    </span>
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#1a6bb5] hover:underline disabled:opacity-50"
                                    disabled={busy}
                                    onClick={() => edit(row)}
                                >
                                    {t("pages.agents.package_terms_edit")}
                                </button>
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#b91c1c] hover:underline disabled:opacity-50"
                                    disabled={busy}
                                    onClick={() => onRemove(row)}
                                >
                                    {t("pages.agents.package_terms_remove")}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-[#e2e5ea] bg-[#f8f9fb] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                    {editing
                        ? t("pages.agents.package_terms_edit_title")
                        : t("pages.agents.package_terms_add_title")}
                </span>

                {selectable.length === 0 && !editing ? (
                    <p className="text-xs text-[#9ca3af]">{t("pages.agents.package_terms_all_added")}</p>
                ) : (
                    <>
                        <select
                            className={`${inputClass} w-full max-w-[280px]`}
                            value={packageId ?? ""}
                            disabled={editing || busy}
                            aria-label={t("pages.agents.package_terms_package")}
                            onChange={(e) =>
                                setPackageId(e.target.value === "" ? null : Number(e.target.value))
                            }
                        >
                            <option value="">{t("pages.agents.package_terms_select_package")}</option>
                            {selectable.map((pkg) => (
                                <option key={pkg.id} value={pkg.id}>
                                    {pkg.name}
                                </option>
                            ))}
                        </select>

                        <CommissionRuleFields
                            label={t("pages.agents.package_terms_as_closer")}
                            unsetLabel={t("pages.agents.package_terms_package_default")}
                            percentageLabel={t("pages.agents.package_terms_percentage")}
                            fixedLabel={t("pages.agents.package_terms_fixed")}
                            noneLabel={t("pages.agents.package_terms_no_commission")}
                            valueLabel={t("pages.agents.package_terms_value")}
                            rule={closer}
                            onChange={setCloser}
                            currencySymbol={currencySymbol}
                            disabled={busy}
                        />

                        <CommissionRuleFields
                            label={t("pages.agents.package_terms_as_referrer")}
                            unsetLabel={t("pages.agents.package_terms_no_referral")}
                            percentageLabel={t("pages.agents.package_terms_percentage")}
                            fixedLabel={t("pages.agents.package_terms_fixed")}
                            noneLabel={t("pages.agents.package_terms_no_commission")}
                            valueLabel={t("pages.agents.package_terms_value")}
                            percentageHint={t("pages.agents.package_terms_of_package_value")}
                            rule={referral}
                            onChange={setReferral}
                            currencySymbol={currencySymbol}
                            disabled={busy}
                        />

                        <div className="flex items-center gap-2">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onSave}
                                loading={save.isPending}
                                disabled={!canSave || busy}
                            >
                                {editing
                                    ? t("pages.agents.package_terms_save")
                                    : t("pages.agents.package_terms_add")}
                            </Button>
                            {packageId !== null && (
                                <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
                                    {t("pages.agents.package_terms_cancel")}
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
