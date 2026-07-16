import type { Deal } from "@/Types/api/deals";
import useDealInfoFieldUpdate from "../../hooks/useDealInfoFieldUpdate";
import useDealInfoNavigation from "../../hooks/useDealInfoNavigation";
import type { DealInfoSectionId } from "../../types";
import DealInfoSectionPanel from "../deal-info/DealInfoSectionPanel";
import DealInfoSidebar from "../deal-info/DealInfoSidebar";
import DealInfoToolbar from "../deal-info/DealInfoToolbar";

interface DealInfoTabProps {
    deal: Deal;
    customFieldCategories: Array<{ id: number; name: string }>;
    fields: any[];
    activeSection: DealInfoSectionId;
    onSectionChange: (section: DealInfoSectionId) => void;
    restrictPackageOrProperty?: boolean;
}

export default function DealInfoTab({
    deal: initialDeal,
    customFieldCategories,
    fields,
    activeSection,
    onSectionChange,
    restrictPackageOrProperty = false,
}: DealInfoTabProps) {
    const { navGroups } = useDealInfoNavigation(
        initialDeal,
        fields,
        customFieldCategories,
    );
    const {
        deal,
        canEdit,
        canDelete,
        isLocked,
        isFieldLoading,
        updatingField,
        isRecalculatingValue,
        handleFieldUpdate,
        handleRecalculateValue,
    } = useDealInfoFieldUpdate(initialDeal);

    return (
        <div>
            <DealInfoToolbar
                deal={deal}
                canDelete={canDelete}
                isLocked={isLocked}
            />

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
                    isRecalculatingValue={isRecalculatingValue}
                    onFieldUpdate={handleFieldUpdate}
                    onRecalculateValue={handleRecalculateValue}
                    restrictPackageOrProperty={restrictPackageOrProperty}
                />
            </div>
        </div>
    );
}
