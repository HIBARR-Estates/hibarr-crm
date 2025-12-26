import { useMemo } from 'react';
import { Form } from 'antd';
import { CustomField } from '@/Types';
import { evaluateAllFieldsVisibility } from '@/lib/customFieldVisibility';

interface UseCustomFieldVisibilityOptions {
    fields: CustomField[];
    form: any;
    namePrefix?: string;
}

/**
 * Hook to manage custom field visibility
 * Watches form values and evaluates visibility rules
 */
export function useCustomFieldVisibility({
    fields,
    form,
    namePrefix = 'custom_fields_data',
}: UseCustomFieldVisibilityOptions) {
    // Watch all custom field values - only if form instance exists
    const allFieldValues = form ? (Form.useWatch(namePrefix, form) || {}) : {};

    // Evaluate visibility for all fields
    const visibilityMap = useMemo(() => {
        // If no form, return default visibility (all fields visible)
        if (!form) {
            return {};
        }
        return evaluateAllFieldsVisibility(fields, allFieldValues);
    }, [fields, allFieldValues, form]);

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


