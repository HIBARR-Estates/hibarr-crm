import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadCustomFieldUpdate from "../../../hooks/useLeadCustomFieldUpdate";

interface FieldsTabProps {
    fields?: any[];
    customFieldCategories?: any[];
}

export default function FieldsTab({
    fields = [],
    customFieldCategories = [],
}: FieldsTabProps) {
    const { lead } = useLeadWorkspace();
    const { updateCustomField, updatingField } = useLeadCustomFieldUpdate();

    if (customFieldCategories.length === 0) {
        return (
            <p className="text-xs text-[#9ca3af]">
                No custom field categories configured for leads.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            {customFieldCategories.map((category) => (
                <CustomFieldDisplay
                    key={category.id}
                    title={category.name}
                    categoryId={category.id}
                    fields={fields}
                    customFieldsData={lead.custom_fields_data ?? {}}
                    editable
                    bare
                    activateOnSingleClick
                    loading={Boolean(updatingField)}
                    loadingField={updatingField}
                    onUpdate={updateCustomField}
                />
            ))}
        </div>
    );
}
