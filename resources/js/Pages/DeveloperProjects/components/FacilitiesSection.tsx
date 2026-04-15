import React from "react";
import { Empty } from "antd";
import { getFacilityIconComponent } from "@/lib/facilityIcons";

export interface FacilityItem {
    name: string;
    label: string;
    icon: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────
const FacilitiesSection: React.FC<{ facilities: FacilityItem[] }> = ({
    facilities,
}) => {
    if (facilities.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg flex items-center justify-center p-8">
                <Empty description="No facilities found" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {facilities.map((facility) => {
                const IconComp = getFacilityIconComponent(facility.icon);
                return (
                    <div
                        key={facility.name}
                        className="flex items-center gap-3 p-4 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                        <span className="text-[#1a2a6c] flex-shrink-0">
                            <IconComp size={20} />
                        </span>
                        <span className="text-sm font-medium text-gray-700 leading-tight">
                            {facility.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default FacilitiesSection;
