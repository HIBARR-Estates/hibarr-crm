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
    // Watch all custom field values
    const allFieldValues = Form.useWatch(namePrefix, form) || {};

    // Evaluate visibility for all fields
    const visibilityMap = useMemo(() => {
        return evaluateAllFieldsVisibility(fields, allFieldValues);
    }, [fields, allFieldValues]);

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


