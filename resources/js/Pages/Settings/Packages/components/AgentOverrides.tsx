import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import usePartnerReferralCommissionFlag from "@/Hooks/usePartnerReferralCommissionFlag";
import type {
    AgentOption,
    AgentOverride,
    CommissionRule,
    PackageCommissionType,
    PackageRow,
} from "../types";

interface Props {
    pkg: PackageRow;
    agents: AgentOption[];
    overrides: AgentOverride[] | undefined;
    currencySymbol: string;
    onLoad: (packageId: number) => void;
    onSave: (
        packageId: number,
        agentId: number,
        closer: CommissionRule,
        /** Null leaves the referral role out: the feature is off. */
        referral: CommissionRule | null,
    ) => Promise<boolean>;
    onRemove: (packageId: number, agentId: number) => void;
}

const inputClass =
    "h-9 rounded-lg border border-[#e2e5ea] bg-white px-3 text-sm text-[#1a1f2e] outline-none focus:border-[#1a6bb5]";

const EMPTY_RULE: CommissionRule = { type: null, value: null };

const needsValue = (rule: CommissionRule) =>
    rule.type === "percentage" || rule.type === "fixed";

/** A rule is ready to save when it is unset, or its value is filled in. */
const isComplete = (rule: CommissionRule) => !needsValue(rule) || rule.value !== null;

/**
 * Per-agent terms on one package. A row holds two roles: what the agent earns as
 * the closer of a deal on this package, and, with the referral feature on, what
 * they earn when a lead they referred buys it. Each role states its own shape;
 * the closer role left unset keeps the package default.
 */
export default function AgentOverrides({
    pkg,
    agents,
    overrides,
    currencySymbol,
    onLoad,
    onSave,
    onRemove,
}: Props) {
    const { td } = useTd();
    const referralEnabled = usePartnerReferralCommissionFlag();
    const [agentId, setAgentId] = useState<number | null>(null);
    const [closer, setCloser] = useState<CommissionRule>(EMPTY_RULE);
    const [referral, setReferral] = useState<CommissionRule>(EMPTY_RULE);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (overrides === undefined) onLoad(pkg.id);
    }, [overrides, onLoad, pkg.id]);

    const assigned = useMemo(
        () => new Set((overrides ?? []).map((o) => o.agent_id)),
        [overrides],
    );

    const editing = agentId !== null && assigned.has(agentId);

    // An agent already on the package stays selectable while they are being
    // edited, so their terms can be changed without removing the row first.
    const selectable = useMemo(
        () => agents.filter((a) => !assigned.has(a.id) || a.id === agentId),
        [agents, assigned, agentId],
    );

    const reset = () => {
        setAgentId(null);
        setCloser(EMPTY_RULE);
        setReferral(EMPTY_RULE);
    };

    const edit = (o: AgentOverride) => {
        setAgentId(o.agent_id);
        setCloser({ type: o.commission_type, value: o.commission_value });
        setReferral({
            type: o.referral_commission_type ?? null,
            value: o.referral_commission_value ?? null,
        });
    };

    const hasTerms = closer.type !== null || (referralEnabled && referral.type !== null);
    const canSave =
        agentId !== null && hasTerms && isComplete(closer) && (!referralEnabled || isComplete(referral));

    const save = async () => {
        if (!canSave || agentId === null) return;
        setSaving(true);
        const ok = await onSave(
            pkg.id,
            agentId,
            { type: closer.type, value: needsValue(closer) ? closer.value : null },
            referralEnabled
                ? { type: referral.type, value: needsValue(referral) ? referral.value : null }
                : null,
        );
        setSaving(false);
        if (ok) reset();
    };

    const money = (amount: number) =>
        `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const describe = (type: PackageCommissionType | null | undefined, value: number | null | undefined, unset: string) => {
        if (!type) return unset;
        if (type === "none" || value === null || value === undefined) {
            return td("No commission", { source: "en" });
        }
        return type === "percentage" ? `${value}%` : money(value);
    };

    return (
        <div className="border-t border-[#eef0f3] bg-[#f8f9fb] px-5 py-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                {td("Agent overrides", { source: "en" })}
            </div>

            {overrides === undefined ? (
                <p className="text-xs text-[#9ca3af]">{td("Loading…", { source: "en" })}</p>
            ) : overrides.length === 0 ? (
                <p className="text-xs text-[#9ca3af]">
                    {td("Every agent uses the package default.", { source: "en" })}
                </p>
            ) : (
                <div className="mb-4 divide-y divide-[#eef0f3] overflow-hidden rounded-lg border border-[#e2e5ea] bg-white">
                    {overrides.map((o) => (
                        <div
                            key={o.agent_id}
                            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3"
                        >
                            <span className="min-w-[160px] text-sm font-medium text-[#1a1f2e]">
                                {o.agent_name}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                <span className="text-sm text-[#5b6472]">
                                    {td("As closer", { source: "en" })}{" "}
                                    <span className="font-semibold text-[#16294d]">
                                        {describe(
                                            o.commission_type,
                                            o.commission_value,
                                            td("Package default", { source: "en" }),
                                        )}
                                    </span>
                                </span>
                                {referralEnabled && (
                                    <span className="text-sm text-[#5b6472]">
                                        {td("As referrer", { source: "en" })}{" "}
                                        <span className="font-semibold text-[#16294d]">
                                            {describe(
                                                o.referral_commission_type,
                                                o.referral_commission_value,
                                                td("Not set", { source: "en" }),
                                            )}
                                        </span>
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#1a6bb5] hover:underline"
                                    onClick={() => edit(o)}
                                >
                                    {td("Edit", { source: "en" })}
                                </button>
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#b91c1c] hover:underline"
                                    onClick={() => onRemove(pkg.id, o.agent_id)}
                                >
                                    {td("Remove", { source: "en" })}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-3">
                <select
                    className={`${inputClass} w-full max-w-[280px]`}
                    value={agentId ?? ""}
                    onChange={(e) =>
                        setAgentId(e.target.value === "" ? null : Number(e.target.value))
                    }
                    disabled={editing}
                    aria-label={td("Agent", { source: "en" })}
                >
                    <option value="">{td("Select an agent", { source: "en" })}</option>
                    {selectable.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                    ))}
                </select>

                <RuleFields
                    label={td("As closer", { source: "en" })}
                    unsetLabel={td("Package default", { source: "en" })}
                    allowNone
                    rule={closer}
                    onChange={setCloser}
                    currencySymbol={currencySymbol}
                />

                {referralEnabled && (
                    <RuleFields
                        label={td("As referrer", { source: "en" })}
                        unsetLabel={td("No referral commission", { source: "en" })}
                        percentageHint={td("of the package value", { source: "en" })}
                        rule={referral}
                        onChange={setReferral}
                        currencySymbol={currencySymbol}
                    />
                )}

                <div className="flex items-center gap-2">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={save}
                        loading={saving}
                        disabled={!canSave}
                    >
                        {editing
                            ? td("Save changes", { source: "en" })
                            : td("Add override", { source: "en" })}
                    </Button>
                    {agentId !== null && (
                        <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                            {td("Cancel", { source: "en" })}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

/** One role's type and value, on a row of its own with a label to say which role it is. */
function RuleFields({
    label,
    unsetLabel,
    percentageHint,
    allowNone = false,
    rule,
    onChange,
    currencySymbol,
}: {
    label: string;
    unsetLabel: string;
    percentageHint?: string;
    allowNone?: boolean;
    rule: CommissionRule;
    onChange: (rule: CommissionRule) => void;
    currencySymbol: string;
}) {
    const { td } = useTd();
    const valued = needsValue(rule);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-[88px] shrink-0 text-xs font-semibold text-[#5b6472]">{label}</span>

            <select
                className={`${inputClass} min-w-[170px]`}
                value={rule.type ?? ""}
                aria-label={label}
                onChange={(e) =>
                    onChange({
                        type: e.target.value === "" ? null : (e.target.value as PackageCommissionType),
                        value: null,
                    })
                }
            >
                <option value="">{unsetLabel}</option>
                <option value="percentage">{td("Percentage", { source: "en" })}</option>
                <option value="fixed">{td("Fixed", { source: "en" })}</option>
                {allowNone && <option value="none">{td("No commission", { source: "en" })}</option>}
            </select>

            <div className="relative">
                <input
                    type="number"
                    min={0}
                    max={rule.type === "percentage" ? 100 : undefined}
                    step="0.01"
                    disabled={!valued}
                    aria-label={`${label} ${td("value", { source: "en" })}`}
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
