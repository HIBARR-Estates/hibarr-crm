import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import DealEditableField from "../primitives/DealEditableField";
import DealSwitch from "../primitives/DealSwitch";
import { ANALYSIS_FIELD_META } from "../../config/analysisFieldMeta";

export interface AnalysisScriptItem {
    id: number;
    type: "custom_field_category" | "native_field" | "hibarr_field" | "lead_field";
    item_key: string;
    label_override?: string | null;
    guide_text?: string | null;
    position: number;
}

interface Props {
    item: AnalysisScriptItem;
    fields: any[];
    canEdit: boolean;
    updatingField?: string | null;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => Promise<void>;
}

export default function AnalysisScriptStep({ item, fields, canEdit, updatingField, onFieldUpdate }: Props) {
    const { td } = useTd();
    const { deal } = useDealWorkspace();

    const meta = ANALYSIS_FIELD_META[item.item_key];
    const label = item.label_override || meta?.label || item.item_key;

    return (
        <div>
            {/* Section heading */}
            <div className="dr-label mb-4">{td(label)}</div>

            {/* Script guide callout */}
            {item.guide_text && (
                <div className="analysis-guide-text mb-5">
                    {item.guide_text}
                </div>
            )}

            {/* Field content */}
            {item.type === "custom_field_category" && (
                <CustomFieldDisplay
                    fields={fields}
                    customFieldsData={deal.custom_fields_data || {}}
                    categoryId={parseInt(item.item_key, 10)}
                    bare
                    column={2}
                    editable={canEdit}
                    activateOnSingleClick
                    onUpdate={(fieldKey: string, value: any) =>
                        onFieldUpdate(fieldKey, value, "custom_field")
                    }
                    loadingField={updatingField}
                    disabled={!canEdit}
                />
            )}

            {item.type === "native_field" && meta && (
                <div className="max-w-sm">
                    <DealEditableField
                        value={(deal as any)[item.item_key] ?? null}
                        fieldName={item.item_key}
                        fieldType={meta.fieldType as any}
                        disabled={!canEdit}
                        loading={updatingField === item.item_key}
                        onSave={(val: unknown) =>
                            onFieldUpdate(item.item_key, val, "details")
                        }
                    />
                </div>
            )}

            {item.type === "hibarr_field" && meta && (
                <div className="max-w-sm">
                    {meta.fieldType === "boolean" ? (
                        <DealSwitch
                            checked={!!(deal as any).hibarrFields?.[item.item_key]}
                            label={td(label)}
                            disabled={!canEdit}
                            loading={updatingField === item.item_key}
                            onChange={() =>
                                onFieldUpdate(
                                    item.item_key,
                                    !(deal as any).hibarrFields?.[item.item_key],
                                    "hibarr_field",
                                )
                            }
                        />
                    ) : (
                        <DealEditableField
                            value={(deal as any).hibarrFields?.[item.item_key] ?? null}
                            fieldName={item.item_key}
                            fieldType={meta.fieldType as any}
                            disabled={!canEdit}
                            loading={updatingField === item.item_key}
                            onSave={(val: unknown) =>
                                onFieldUpdate(item.item_key, val, "hibarr_field")
                            }
                        />
                    )}
                </div>
            )}

            {item.type === "lead_field" && meta && (
                <div className="max-w-sm">
                    <DealEditableField
                        value={(deal.contact as any)?.[item.item_key] ?? null}
                        fieldName={item.item_key}
                        fieldType={meta.fieldType as any}
                        disabled={!canEdit}
                        loading={updatingField === item.item_key}
                        onSave={(val: unknown) =>
                            onFieldUpdate(item.item_key, val, "contact")
                        }
                    />
                </div>
            )}

            {!meta && item.type !== "custom_field_category" && (
                <p className="text-[13px] italic" style={{ color: "#9ca3af" }}>
                    {td("Field not configured.")}
                </p>
            )}
        </div>
    );
}
