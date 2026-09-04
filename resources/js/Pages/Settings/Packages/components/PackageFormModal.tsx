import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalField, Button } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import RoutingTriggersEditor from "./RoutingTriggersEditor";
import type {
    PackageFormValues,
    PackageRow,
    PackageCommissionType,
    PipelineOption,
    RoutingFieldOption,
    RoutingTrigger,
    StageOption,
} from "../types";

interface Props {
    open: boolean;
    /** Null when creating. */
    pkg: PackageRow | null;
    pipelines: PipelineOption[];
    stages: StageOption[];
    /** Every field routing can watch, company-wide. */
    routingFieldItems: RoutingFieldOption[];
    currencySymbol: string;
    currencyCode: string;
    saving: boolean;
    onClose: () => void;
    onSubmit: (values: PackageFormValues) => Promise<boolean>;
    /**
     * Fetches this package's saved triggers plus a field picklist that also
     * covers any field the package still references after it was disabled —
     * so a stale trigger surfaces instead of silently vanishing on save.
     */
    onLoadRoutingTriggers: (
        packageId: number,
    ) => Promise<{ triggers: RoutingTrigger[]; fieldItems: RoutingFieldOption[] }>;
}

const EMPTY: PackageFormValues = {
    name: "",
    value: null,
    currency: "",
    description: "",
    customer_type_name: "",
    customer_type_description: "",
    pipeline_id: null,
    default_stage_id: null,
    commission_type: null,
    commission_value: null,
    routing_triggers: [],
};

const toForm = (
    pkg: PackageRow,
    defaultCurrencyCode: string,
): PackageFormValues => ({
    name: pkg.name,
    value: pkg.value,
    currency: pkg.currency ?? defaultCurrencyCode,
    description: pkg.description ?? "",
    customer_type_name: pkg.customer_type_name ?? "",
    customer_type_description: pkg.customer_type_description ?? "",
    pipeline_id: pkg.pipeline_id,
    default_stage_id: pkg.default_stage_id,
    commission_type: pkg.commission_type,
    commission_value: pkg.commission_value,
    // Filled in by onLoadRoutingTriggers once the dialog is open — a package
    // row doesn't carry its full trigger list, only a count.
    routing_triggers: [],
});

export default function PackageFormModal({
    open,
    pkg,
    pipelines,
    stages,
    routingFieldItems,
    currencySymbol,
    currencyCode,
    saving,
    onClose,
    onSubmit,
    onLoadRoutingTriggers,
}: Props) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [values, setValues] = useState<PackageFormValues>(EMPTY);
    const [dirty, setDirty] = useState(false);
    // Falls back to the company-wide list until an existing package's own
    // triggers (and any stale field they reference) come back from the load.
    const [fieldItems, setFieldItems] =
        useState<RoutingFieldOption[]>(routingFieldItems);

    useEffect(() => {
        if (!open) return;
        setDirty(false);

        if (!pkg) {
            setValues({ ...EMPTY, currency: currencyCode });
            setFieldItems(routingFieldItems);
            return;
        }

        setValues(toForm(pkg, currencyCode));
        setFieldItems(routingFieldItems);

        if (pkg.routing_triggers_count === 0) return;

        let cancelled = false;
        onLoadRoutingTriggers(pkg.id).then(({ triggers, fieldItems: items }) => {
            if (cancelled) return;
            setValues((prev) => ({ ...prev, routing_triggers: triggers }));
            setFieldItems(items);
        });

        return () => {
            cancelled = true;
        };
    }, [open, pkg, routingFieldItems, onLoadRoutingTriggers, currencyCode]);

    const set = <K extends keyof PackageFormValues>(
        key: K,
        value: PackageFormValues[K],
    ) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        setDirty(true);
    };

    // Stages belong to one pipeline, so the choice has to narrow with it.
    const availableStages = useMemo(
        () =>
            values.pipeline_id === null
                ? []
                : stages.filter((s) => s.lead_pipeline_id === values.pipeline_id),
        [stages, values.pipeline_id],
    );

    const needsRate =
        values.commission_type === "percentage" || values.commission_type === "fixed";
    const nameMissing = values.name.trim() === "";
    const valueMissing = values.value === null || Number.isNaN(values.value);
    const rateMissing = needsRate && values.commission_value === null;
    const canSave = !nameMissing && !valueMissing && !rateMissing && !saving;

    const submit = async () => {
        if (!canSave) return;
        const ok = await onSubmit(values);
        if (ok) onClose();
    };

    const earns = !needsRate || values.commission_value === null
        ? null
        : values.commission_type === "percentage"
          ? ((values.value ?? 0) * values.commission_value) / 100
          : values.commission_value;

    return (
        <Modal
            open={open}
            title={
                pkg
                    ? td("Edit package", { source: "en" })
                    : td("New package", { source: "en" })
            }
            subtitle={pkg?.name}
            onClose={onClose}
            dirty={dirty}
            maxWidth={640}
            footer={
                <>
                    <Button onClick={onClose}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={submit}
                        disabled={!canSave}
                        loading={saving}
                    >
                        {pkg
                            ? td("Save changes", { source: "en" })
                            : td("Create package", { source: "en" })}
                    </Button>
                </>
            }
        >
            <ModalField label={td("Name", { source: "en" })}>
                <input
                    value={values.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder={td("e.g. Gold", { source: "en" })}
                    autoFocus
                />
            </ModalField>

            <div className="grid grid-cols-2 gap-4">
                <ModalField label={td("Value", { source: "en" })}>
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={values.value ?? ""}
                        onChange={(e) =>
                            set(
                                "value",
                                e.target.value === "" ? null : Number(e.target.value),
                            )
                        }
                    />
                </ModalField>

                <ModalField label={td("Price currency", { source: "en" })}>
                    <input
                        value={values.currency}
                        maxLength={3}
                        onChange={(e) =>
                            set("currency", e.target.value.toUpperCase())
                        }
                    />
                </ModalField>
            </div>

            <ModalField label={td("Description", { source: "en" })}>
                <textarea
                    rows={2}
                    value={values.description}
                    onChange={(e) => set("description", e.target.value)}
                />
            </ModalField>

            <div className="grid grid-cols-2 gap-4">
                <ModalField label={td("Pipeline", { source: "en" })}>
                    <select
                        value={values.pipeline_id ?? ""}
                        onChange={(e) => {
                            const next =
                                e.target.value === "" ? null : Number(e.target.value);
                            setValues((prev) => ({
                                ...prev,
                                pipeline_id: next,
                                // A stage from the old pipeline would fail validation.
                                default_stage_id: null,
                            }));
                            setDirty(true);
                        }}
                    >
                        <option value="">{td("None", { source: "en" })}</option>
                        {pipelines.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </ModalField>

                <ModalField label={td("Default stage", { source: "en" })}>
                    <select
                        value={values.default_stage_id ?? ""}
                        disabled={values.pipeline_id === null}
                        onChange={(e) =>
                            set(
                                "default_stage_id",
                                e.target.value === "" ? null : Number(e.target.value),
                            )
                        }
                    >
                        <option value="">{td("None", { source: "en" })}</option>
                        {availableStages.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </ModalField>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ModalField label={td("Commission", { source: "en" })}>
                    <select
                        value={values.commission_type ?? ""}
                        onChange={(e) => {
                            const next = (e.target.value || null) as
                                | PackageCommissionType
                                | null;
                            setValues((prev) => ({
                                ...prev,
                                commission_type: next,
                                commission_value: null,
                            }));
                            setDirty(true);
                        }}
                    >
                        <option value="">
                            {td("Use level commission", { source: "en" })}
                        </option>
                        <option value="percentage">
                            {td("Percentage of package value", { source: "en" })}
                        </option>
                        <option value="fixed">
                            {td("Fixed fee", { source: "en" })}
                        </option>
                        <option value="none">
                            {td("No commission", { source: "en" })}
                        </option>
                    </select>
                </ModalField>

                <ModalField
                    label={
                        values.commission_type === "fixed"
                            ? td("Fee", { source: "en" })
                            : td("Rate", { source: "en" })
                    }
                >
                    <input
                        type="number"
                        min={0}
                        max={values.commission_type === "percentage" ? 100 : undefined}
                        step="0.01"
                        disabled={!needsRate}
                        value={values.commission_value ?? ""}
                        onChange={(e) =>
                            set(
                                "commission_value",
                                e.target.value === "" ? null : Number(e.target.value),
                            )
                        }
                    />
                </ModalField>
            </div>

            {values.commission_type === "none" && (
                <p className="-mt-2 mb-4 text-xs text-[#5b6472]">
                    {td(
                        "This package pays no commission at all — not even the level-based split.",
                        { source: "en" },
                    )}
                </p>
            )}

            {earns !== null && (
                <p className="-mt-2 mb-4 text-xs text-[#5b6472]">
                    {td("The closing agent earns", { source: "en" })}{" "}
                    <span className="font-semibold text-[#177a5b]">
                        {currencySymbol}
                        {earns.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </span>{" "}
                    {td("on this package, and no upline or system commission is generated.", {
                        source: "en",
                    })}
                </p>
            )}

            <div className="grid grid-cols-2 gap-4">
                <ModalField label={td("Customer type", { source: "en" })}>
                    <input
                        value={values.customer_type_name}
                        onChange={(e) => set("customer_type_name", e.target.value)}
                    />
                </ModalField>

                <ModalField label={td("Customer type notes", { source: "en" })}>
                    <input
                        value={values.customer_type_description}
                        onChange={(e) =>
                            set("customer_type_description", e.target.value)
                        }
                    />
                </ModalField>
            </div>

            <hr className="my-4 border-[#eef0f3]" />

            <div className="mb-3 modal-field">
                <label>{t("modules.deal.packageRoutingTriggers")}</label>
                <p className="-mt-1 text-xs font-normal normal-case tracking-normal text-[#9ca3af]">
                    {t("modules.deal.packageRoutingTriggersHint")}
                </p>
            </div>

            <RoutingTriggersEditor
                triggers={values.routing_triggers}
                fieldItems={fieldItems}
                onChange={(next) => set("routing_triggers", next)}
            />
        </Modal>
    );
}
