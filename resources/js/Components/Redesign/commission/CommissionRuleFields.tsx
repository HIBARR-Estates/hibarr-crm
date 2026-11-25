export type CommissionRuleType = "percentage" | "fixed" | "none";

/** One role's rule as an editor holds it. A null type means "not set". */
export interface CommissionRuleDraft {
    type: CommissionRuleType | null;
    value: number | null;
}

export const EMPTY_COMMISSION_RULE: CommissionRuleDraft = { type: null, value: null };

export const ruleNeedsValue = (rule: CommissionRuleDraft) =>
    rule.type === "percentage" || rule.type === "fixed";

/** A rule is ready to save when it is unset, or its value is filled in. */
export const isRuleComplete = (rule: CommissionRuleDraft) =>
    !ruleNeedsValue(rule) || rule.value !== null;

/** What the editor sends: a value only for the types that carry one. */
export const ruleForSave = (rule: CommissionRuleDraft): CommissionRuleDraft => ({
    type: rule.type,
    value: ruleNeedsValue(rule) ? rule.value : null,
});

const inputClass =
    "h-9 rounded-lg border border-[#e2e5ea] bg-white px-3 text-sm text-[#1a1f2e] outline-none focus:border-[#1a6bb5]";

interface CommissionRuleFieldsProps {
    /** Names the role this rule is for: "As closer", "As referrer". */
    label: string;
    /** The option for a rule that is not set, and what that means for this role. */
    unsetLabel: string;
    percentageLabel: string;
    fixedLabel: string;
    /** Offers a "pays nothing" option; omit it where it is not a valid choice. */
    noneLabel?: string;
    valueLabel: string;
    /** Says what a percentage is taken from, e.g. "of the package value". */
    percentageHint?: string;
    rule: CommissionRuleDraft;
    onChange: (rule: CommissionRuleDraft) => void;
    currencySymbol: string;
    disabled?: boolean;
}

/**
 * One role's type and value on a row of its own. Package overrides and a
 * partner's package terms share it, so the same rule is entered the same way
 * wherever it is edited. Copy comes in as props because the two screens that
 * use it translate their strings differently.
 */
export default function CommissionRuleFields({
    label,
    unsetLabel,
    percentageLabel,
    fixedLabel,
    noneLabel,
    valueLabel,
    percentageHint,
    rule,
    onChange,
    currencySymbol,
    disabled = false,
}: CommissionRuleFieldsProps) {
    const valued = ruleNeedsValue(rule);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-[88px] shrink-0 text-xs font-semibold text-[#5b6472]">{label}</span>

            <select
                className={`${inputClass} min-w-[170px]`}
                value={rule.type ?? ""}
                aria-label={label}
                disabled={disabled}
                onChange={(e) =>
                    onChange({
                        type: e.target.value === "" ? null : (e.target.value as CommissionRuleType),
                        value: null,
                    })
                }
            >
                <option value="">{unsetLabel}</option>
                <option value="percentage">{percentageLabel}</option>
                <option value="fixed">{fixedLabel}</option>
                {noneLabel && <option value="none">{noneLabel}</option>}
            </select>

            <div className="relative">
                <input
                    type="number"
                    min={0}
                    max={rule.type === "percentage" ? 100 : undefined}
                    step="0.01"
                    disabled={disabled || !valued}
                    aria-label={`${label} ${valueLabel}`}
                    className={`${inputClass} w-32 pr-9`}
                    value={rule.value ?? ""}
                    onChange={(e) =>
                        onChange({
                            ...rule,
                            value: e.target.value === "" ? null : Number(e.target.value),
                        })
                    }
                />
                {valued && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9ca3af]">
                        {rule.type === "percentage" ? "%" : currencySymbol}
                    </span>
                )}
            </div>

            {percentageHint && rule.type === "percentage" && (
                <span className="text-xs text-[#9ca3af]">{percentageHint}</span>
            )}
        </div>
    );
}
