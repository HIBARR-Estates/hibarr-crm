import { useMemo } from 'react';
import { Form } from 'antd';
import { CustomField } from '@/Types';
import { evaluateAllFieldsVisibility, VisibilityEvaluationContext } from '@/lib/customFieldVisibility';
import { buildFieldValueMap, FieldValueMapContext } from '@/lib/customFieldValueMap';

interface UseCustomFieldVisibilityOptions {
    fields: CustomField[];
    form: any;
    namePrefix?: string;
    /**
     * Record context a rule can read beyond the form's own field values —
     * pipeline / pipeline_stage / package / record. Without it those sources
     * evaluate as unset here while resolving correctly elsewhere on the page,
     * so the same rule can disagree between two views of the same record.
     */
    context?: FieldValueMapContext;
    /** Stage list for ordering (`>=`, `<=`) `pipeline_stage` criteria. */
    evaluationContext?: VisibilityEvaluationContext;
}

/**
 * Hook to manage custom field visibility
 * Watches form values and evaluates visibility rules
 */
export function useCustomFieldVisibility({
    fields,
    form,
    namePrefix = 'custom_fields_data',
    context,
    evaluationContext,
}: UseCustomFieldVisibilityOptions) {
    // Always call Form.useWatch unconditionally at the top level to comply with Rules of Hooks
    // If form is null/undefined, the hook will return undefined, which we handle below
    const watched = Form.useWatch(namePrefix, form || undefined);
    // Derive allFieldValues by defaulting watched to {} after the hook call
    const allFieldValues = watched || {};

    // Evaluate visibility for all fields
    const visibilityMap = useMemo(() => {
        // If no form, return default visibility (all fields visible)
        if (!form) {
            return {};
        }
        return evaluateAllFieldsVisibility(
            fields,
            buildFieldValueMap({ customFieldsData: allFieldValues, context }),
            evaluationContext,
        );
    }, [fields, allFieldValues, form, context, evaluationContext]);

    /**
     * Check if a field is visible
     */
    const isFieldVisible = (fieldId: number): boolean => {
        return visibilityMap[fieldId] !== false;
    };

    /**
     * Get visibility map
     */
    const getVisibilityMap = (): Record<number, boolean> => {
        return visibilityMap;
    };

    return {
        visibilityMap,
        isFieldVisible,
        getVisibilityMap,
    };
}


