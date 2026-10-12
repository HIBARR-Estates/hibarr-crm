export const PROPERTY_COMPLETENESS_FLAG = "crm.property-completeness-score";

export type PropertyCompleteness = {
    filled: number;
    total: number;
    percent: number;
};
