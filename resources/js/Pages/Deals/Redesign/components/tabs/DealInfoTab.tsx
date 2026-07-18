import type { Deal } from "@/Types/api/deals";
import useDealInfoFieldUpdate from "../../hooks/useDealInfoFieldUpdate";
import useDealInfoNavigation from "../../hooks/useDealInfoNavigation";
import type { DealInfoSectionId } from "../../types";
import DealInfoSectionPanel from "../deal-info/DealInfoSectionPanel";
import DealInfoSidebar from "../deal-info/DealInfoSidebar";

interface DealInfoTabProps {
    deal: Deal;
    customFieldCategories: Array<{ id: number; name: string }>;
    fields: any[];
    activeSection: DealInfoSectionId;
    onSectionChange: (section: DealInfoSectionId) => void;
    restrictPackageOrProperty?: boolean;
    consents?: any[];
    gdprSetting?: { enable_gdpr?: boolean } | null;
}

export default function DealInfoTab({
    deal: initialDeal,
    customFieldCategories,
    fields,
    activeSection,
    onSectionChange,
    restrictPackageOrProperty = false,
    consents,
    gdprSetting,
}: DealInfoTabProps) {
    const { navGroups } = useDealInfoNavigation(
        initialDeal,
        fields,
        customFieldCategories,
        consents,
    );
    const {
        deal,
        canEdit,
        isLocked,
        isFieldLoading,
        updatingField,
        handleFieldUpdate,
    } = useDealInfoFieldUpdate();

    return (
        <div>
            <div
                className="grid min-h-[500px] gap-0"
                style={{ gridTemplateColumns: "210px 1fr" }}
            >
                <DealInfoSidebar
                    navGroups={navGroups}
                    activeSection={activeSection}
                    onSectionChange={onSectionChange}
                />
                <DealInfoSectionPanel
                    sectionId={activeSection}
                    deal={deal}
                    fields={fields}
                    customFieldCategories={customFieldCategories}
                    canEdit={canEdit}
                    isLocked={isLocked}
                    isFieldLoading={isFieldLoading}
                    updatingField={updatingField}
                    onFieldUpdate={handleFieldUpdate}
                    restrictPackageOrProperty={restrictPackageOrProperty}
                    consents={consents}
                    gdprSetting={gdprSetting}
                />
            </div>
        </div>
    );
}
