import type { Deal } from "@/Types/api/deals";
import useDealInfoFieldUpdate from "../../hooks/useDealInfoFieldUpdate";
import useDealInfoNavigation from "../../hooks/useDealInfoNavigation";
import type { DealInfoSectionId } from "../../types";
import DealInfoSectionPanel from "../deal-info/DealInfoSectionPanel";
import DealInfoSidebar from "../deal-info/DealInfoSidebar";

interface DealInfoTabProps {
    deal: Deal;
    customFieldCategories: Array<{ id: number; name: string }>;
    visibleFieldKeys?: string[] | null;
    fields: any[];
    activeSection: DealInfoSectionId;
    onSectionChange: (section: DealInfoSectionId) => void;
    restrictPackageOrProperty?: boolean;
    consents?: any[];
    gdprSetting?: { enable_gdpr?: boolean } | null;
    /** crm.deal-info-count-indicator — dot instead of the "filled/total" text badge. */
    showCompletionDot?: boolean;
}

export default function DealInfoTab({
    customFieldCategories,
    visibleFieldKeys,
    fields,
    activeSection,
    onSectionChange,
    restrictPackageOrProperty = false,
    consents,
    gdprSetting,
    showCompletionDot = false,
}: DealInfoTabProps) {
    const {
        deal,
        canEdit,
        isLocked,
        isFieldLoading,
        updatingField,
        handleFieldUpdate,
        handleFieldsUpdate,
    } = useDealInfoFieldUpdate();
    const { navGroups } = useDealInfoNavigation(
        deal,
        fields,
        customFieldCategories,
        consents,
        gdprSetting,
        visibleFieldKeys,
    );

    return (
        <div>
            <div
                className="grid min-h-[500px] gap-0"
                style={{ gridTemplateColumns: "210px minmax(0, 1fr)" }}
            >
                <DealInfoSidebar
                    navGroups={navGroups}
                    activeSection={activeSection}
                    onSectionChange={onSectionChange}
                    showCompletionDot={showCompletionDot}
                />
                <DealInfoSectionPanel
                    sectionId={activeSection}
                    deal={deal}
                    fields={fields}
                    customFieldCategories={customFieldCategories}
                    visibleFieldKeys={visibleFieldKeys}
                    canEdit={canEdit}
                    isLocked={isLocked}
                    isFieldLoading={isFieldLoading}
                    updatingField={updatingField}
                    onFieldUpdate={handleFieldUpdate}
                    onFieldsUpdate={handleFieldsUpdate}
                    restrictPackageOrProperty={restrictPackageOrProperty}
                    consents={consents}
                    gdprSetting={gdprSetting}
                />
            </div>
        </div>
    );
}
