/**
 * FieldRenderer
 *
 * Maps a dynamic array of `CustomField` objects (typed from @/Types) plus stored
 * values into a grid of `DetailSection`/`DetailField` cells.
 *
 * This is a thin, strongly-typed façade over `CustomFieldDisplay` which owns all
 * the per-field-type rendering and visibility-rule evaluation logic. Using this
 * component in detail views keeps the call-site clean and decoupled from the
 * internal `Field` interface used by `CustomFieldDisplay`.
 */
import React from "react";
import { type CustomField } from "@/Types";
import CustomFieldDisplay from "./CustomFieldDisplay";

interface FieldRendererProps {
    fields: CustomField[];
    values: Record<string, any>;
    /** When true all fields render as inputs; false = read-only labels */
    isEditing?: boolean;
    /** Called when a field value changes (pending-changes tracking) */
    onChange?: (fieldName: string, value: any) => void;
    /** Called to persist a single field value immediately */
    onSave?: (fieldName: string, value: any) => Promise<void>;
    /** The field currently being saved (shows per-field loading indicator) */
    loadingField?: string | null;
    /** When true all fields are disabled (saving-all in progress) */
    globalLoading?: boolean;
    /** When true, editing is disabled regardless of isEditing */
    disabled?: boolean;
    /** Restrict to a specific category id */
    categoryId?: string | number;
    /** The record (Deal/Lead/...) these fields belong to — backs a `record`-source visibility rule ("restrict to specific record(s)"). */
    recordId?: number | string | null;
}

export default function FieldRenderer({
    fields,
    values,
    isEditing = false,
    onChange,
    onSave,
    loadingField,
    globalLoading,
    disabled,
    categoryId,
    recordId,
}: FieldRendererProps) {
    // Convert typed CustomField[] to the shape CustomFieldDisplay expects for `fields`
    const adaptedFields = fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        values: f.values ?? undefined,
        custom_field_category_id: f.custom_field_group_id,
        show_rule_set: f.show_rule_set,
        linked_field_id: f.linked_field_id ?? undefined,
        display_config: f.display_config ?? undefined,
    }));

    return (
        <CustomFieldDisplay
            fields={adaptedFields}
            customFieldsData={values}
            categoryId={categoryId}
            column={2}
            onUpdate={onSave}
            editable={isEditing}
            alwaysEditing={isEditing}
            onChange={onChange}
            loadingField={loadingField ?? null}
            globalLoading={globalLoading}
            disabled={disabled}
            recordId={recordId}
        />
    );
}
