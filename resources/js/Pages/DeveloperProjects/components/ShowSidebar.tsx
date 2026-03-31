import React from "react";
import { Link } from "@inertiajs/react";
import { Button } from "antd";
import {
    LayoutGrid,
    Users,
    Layers,
    Image,
    Home,
    DollarSign,
    FileText,
    Pencil,
} from "lucide-react";
import type { SectionKey } from "../Show";

interface ShowSidebarProps {
    activeSection: SectionKey;
    onSelect: (key: SectionKey) => void;
    onEdit: () => void;
    unitTypesCount: number;
    exteriorCount: number;
    interiorCount: number;
    siteplanCount: number;
}

const ShowSidebar: React.FC<ShowSidebarProps> = ({
    activeSection,
    onSelect,
    onEdit,
    unitTypesCount,
    exteriorCount,
    interiorCount,
    siteplanCount,
}) => {
    const navItems: { key: SectionKey; icon: React.ReactNode; label: string }[] = [
        { key: "overview", icon: <LayoutGrid size={16} />, label: "Overview" },
        { key: "developers", icon: <Users size={16} />, label: "Developer" },
        {
            key: "unit_types",
            icon: <Layers size={16} />,
            label: `Unit Types (${unitTypesCount})`,
        },
        { key: "photos", icon: <Image size={16} />, label: "Photos" },
        { key: "facilities", icon: <Home size={16} />, label: "Facilities" },
        {
            key: "exterior",
            icon: <Image size={16} />,
            label: `Exterior (${exteriorCount})`,
        },
        {
            key: "interior",
            icon: <Image size={16} />,
            label: `Interior (${interiorCount})`,
        },
        {
            key: "siteplan",
            icon: <Image size={16} />,
            label: `Site Plan (${siteplanCount})`,
        },
        { key: "pricelist", icon: <DollarSign size={16} />, label: "Price List" },
        { key: "pdf", icon: <FileText size={16} />, label: "PDF Files" },
        // {
        //     key: "offers",
        //     icon: <GiftOutlined />,
        //     label: "Offers",
        // },
    ];

    return (
        <div className="w-64 flex-shrink-0 sticky top-4 flex flex-col gap-2">
            {/* Nav items – each is its own card */}
            {navItems.map((item) => (
                <div
                    key={item.key}
                    onClick={() => onSelect(item.key)}
                    className={`flex items-center gap-4 p-2 rounded-md border cursor-pointer hover:${activeSection === item.key? 'bg-gray-600': 'bg-gray-50'} transition-colors ${
                        activeSection === item.key
                            ? "bg-[#1a2a6c] text-white border-[#1a2a6c]"
                            : "bg-white border-gray-200 text-gray-700"
                    }`}
                >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                </div>
            ))}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
                <Button icon={<Pencil size={14} />} block onClick={onEdit}>
                    Edit Project
                </Button>
            </div>
        </div>
    );
};

export default ShowSidebar;
