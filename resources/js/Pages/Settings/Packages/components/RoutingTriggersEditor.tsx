import React from "react";
import { Button } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import type { RoutingFieldOption, RoutingMatchMode, RoutingTrigger } from "../types";

interface Props {
    triggers: RoutingTrigger[];
    fieldItems: RoutingFieldOption[];
    onChange: (next: RoutingTrigger[]) => void;
}

const EMPTY_ROW: RoutingTrigger = {
    field_key: "",
    match_mode: "exact",
    match_value: "",
};

const inputClass =
    "h-9 w-full rounded-lg border border-[#e2e5ea] bg-white px-3 text-sm text-[#1a1f2e] outline-none focus:border-[#1a6bb5] disabled:bg-[#f8f9fb] disabled:text-[#9ca3af]";

/**
 * "When a deal field matches, route it onto this package" rules — the same
 * catalog and semantics as the Blade package form's routing trigger builder
 * (`PackageRoutingFieldCatalog`), rebuilt as plain controlled inputs so the
 * rows live in the same save as the rest of the package.
 */
export default function RoutingTriggersEditor({ triggers, fieldItems, onChange }: Props) {
    const { t } = useTranslation();

    const updateRow = (index: number, patch: Partial<RoutingTrigger>) => {
        const next = triggers.map((row, i) => {
            if (i !== index) return row;
            const merged = { ...row, ...patch };
            // A "present" check has no value to compare against.
            if (merged.match_mode === "present") merged.match_value = null;
            return merged;
        });
        onChange(next);
    };

    const addRow = () => onChange([...triggers, { ...EMPTY_ROW }]);
    const removeRow = (index: number) =>
        onChange(triggers.filter((_, i) => i !== index));

    if (fieldItems.length === 0) {
        return (
            <p className="text-xs text-[#b45309]">
                {t("modules.deal.packageRoutingTriggersNoFields")}
            </p>
        );
    }

    return (
        <div>
            {triggers.length > 0 && (
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_36px] gap-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                    <span>{t("modules.deal.routingTriggerField")}</span>
                    <span>{t("modules.deal.routingTriggerMatchMode")}</span>
                    <span>{t("modules.deal.routingTriggerMatchValue")}</span>
                    <span />
                </div>
            )}

            <div className="space-y-2">
                {triggers.map((row, index) => {
                    const isStale = fieldItems.some(
                        (item) => item.value === row.field_key && item.stale,
                    );

                    return (
                        <div key={index}>
                            {isStale && (
                                <p className="mb-1 text-xs text-[#b45309]">
                                    {t("modules.deal.routingTriggerFieldDisabledRow")}
                                </p>
                            )}
                            <div className="grid grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_36px] items-center gap-2">
                                <select
                                    className={inputClass}
                                    value={row.field_key}
                                    onChange={(e) =>
                                        updateRow(index, { field_key: e.target.value })
                                    }
                                >
                                    <option value="" disabled>
                                        {t("modules.deal.routingTriggerField")}
                                    </option>
                                    {fieldItems.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    className={inputClass}
                                    value={row.match_mode}
                                    onChange={(e) =>
                                        updateRow(index, {
                                            match_mode: e.target
                                                .value as RoutingMatchMode,
                                        })
                                    }
                                >
                                    <option value="exact">
                                        {t("modules.deal.routingTriggerMatchModeExact")}
                                    </option>
                                    <option value="present">
                                        {t(
                                            "modules.deal.routingTriggerMatchModePresent",
                                        )}
                                    </option>
                                </select>

                                <input
                                    className={inputClass}
                                    value={row.match_value ?? ""}
                                    disabled={row.match_mode === "present"}
                                    placeholder={t(
                                        "modules.deal.routingTriggerMatchValuePlaceholder",
                                    )}
                                    onChange={(e) =>
                                        updateRow(index, { match_value: e.target.value })
                                    }
                                />

                                <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#b91c1c] hover:bg-[#fef2f2]"
                                    onClick={() => removeRow(index)}
                                    aria-label={t("app.remove")}
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Button size="sm" className="mt-2" onClick={addRow}>
                {t("modules.deal.addRoutingTrigger")}
            </Button>
        </div>
    );
}
