import React, { useEffect, useMemo, useState } from "react";
import {
    Button,
    CommissionRuleFields,
    ConfirmDialog,
    EMPTY_COMMISSION_RULE as EMPTY_RULE,
    isRuleComplete as isComplete,
    ruleForSave,
    ruleNeedsValue as needsValue,
} from "@/Components/Redesign";
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
    const [removeTarget, setRemoveTarget] = useState<AgentOverride | null>(null);

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
            ruleForSave(closer),
            referralEnabled ? ruleForSave(referral) : null,
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
                                    className="text-xs font-medium text-[#1a6bb5] hover:underline disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => edit(o)}
                                >
                                    {td("Edit", { source: "en" })}
                                </button>
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#b91c1c] hover:underline disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => {
                                        // The row holds the referral terms too, so removing it
                                        // quietly would also end what the agent earns as referrer.
                                        if (referralEnabled && o.referral_commission_type) {
                                            setRemoveTarget(o);
                                        } else {
                                            onRemove(pkg.id, o.agent_id);
                                        }
                                    }}
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
                    disabled={editing || saving}
                    aria-label={td("Agent", { source: "en" })}
                >
                    <option value="">{td("Select an agent", { source: "en" })}</option>
                    {selectable.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                    ))}
                </select>

                <CommissionRuleFields
                    label={td("As closer", { source: "en" })}
                    unsetLabel={td("Package default", { source: "en" })}
                    percentageLabel={td("Percentage", { source: "en" })}
                    fixedLabel={td("Fixed", { source: "en" })}
                    noneLabel={td("No commission", { source: "en" })}
                    valueLabel={td("value", { source: "en" })}
                    rule={closer}
                    onChange={setCloser}
                    currencySymbol={currencySymbol}
                    disabled={saving}
                />

                {referralEnabled && (
                    <CommissionRuleFields
                        label={td("As referrer", { source: "en" })}
                        unsetLabel={td("No referral commission", { source: "en" })}
                        percentageLabel={td("Percentage", { source: "en" })}
                        fixedLabel={td("Fixed", { source: "en" })}
                        valueLabel={td("value", { source: "en" })}
                        percentageHint={td("of the package value", { source: "en" })}
                        rule={referral}
                        onChange={setReferral}
                        currencySymbol={currencySymbol}
                        disabled={saving}
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

            <ConfirmDialog
                open={removeTarget !== null}
                title={td("Remove this agent's terms?", { source: "en" })}
                message={td(
                    "This removes what they earn as closer and as referrer on this package. To change only one, edit the row instead.",
                    { source: "en" },
                )}
                confirmLabel={td("Remove", { source: "en" })}
                danger
                onConfirm={() => {
                    if (removeTarget) onRemove(pkg.id, removeTarget.agent_id);
                    setRemoveTarget(null);
                }}
                onCancel={() => setRemoveTarget(null)}
            />
        </div>
    );
}
