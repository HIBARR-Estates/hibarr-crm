import React from "react";
import { ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";
import type { SectionKey } from "../Show";

const SECTION_LABELS: Record<SectionKey, string> = {
    overview: "Overview",
    developers: "Developer",
    unit_types: "Unit Types",
    photos: "Photos",
    facilities: "Facilities",
    exterior: "Exterior",
    interior: "Interior",
    siteplan: "Site Plan",
    pricelist: "Price List",
    pdf: "PDF Files",
    offers: "Offers",
};

interface MobileSidebarToggleProps {
    isOpen: boolean;
    onToggle: () => void;
    activeSection: SectionKey;
}

const MobileSidebarToggle: React.FC<MobileSidebarToggleProps> = ({
    isOpen,
    onToggle,
    activeSection,
}) => (
    <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-colors hover:bg-gray-50"
    >
        <span className="flex items-center gap-2">
            <span className="text-[#1a2a6c]">
                <LayoutGrid size={16} />
            </span>
            <span className="text-gray-500">Sections</span>
            <span className="mx-0.5 text-gray-300">›</span>
            <span className="font-medium text-slate-900">
                {SECTION_LABELS[activeSection]}
            </span>
        </span>
        {isOpen ? (
            <ChevronUp size={16} className="text-gray-400" />
        ) : (
            <ChevronDown size={16} className="text-gray-400" />
        )}
    </button>
);

export default MobileSidebarToggle;
