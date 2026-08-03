import useLeadFieldUpdate from "./useLeadFieldUpdate";

/** Thin wrapper — custom field writes go through the dossier patch endpoint. */
export default function useLeadCustomFieldUpdate() {
    const { updateCustomField, updatingField } = useLeadFieldUpdate();
    return { updateCustomField, updatingField };
}
