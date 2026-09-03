import { useMemo } from 'react';
import { Form } from 'antd';
import { CustomField } from '@/Types';
import { evaluateAllFieldsVisibility } from '@/lib/customFieldVisibility';
import { buildFieldValueMap } from '@/lib/customFieldValueMap';

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
            buildFieldValueMap({ customFieldsData: allFieldValues }),
        );
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


