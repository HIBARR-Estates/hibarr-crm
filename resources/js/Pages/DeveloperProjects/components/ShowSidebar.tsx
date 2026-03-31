import React from "react";
import { Link } from "@inertiajs/react";
import { Button } from "antd";
import {
    ArrowLeft,
    LayoutGrid,
    Users,
    Layers,
    Image,
    Home,
    DollarSign,
    FileText,
    Pencil,
    Settings2,
} from "lucide-react";
import type { SectionKey } from "../Show";

interface ShowSidebarProps {
    activeSection: SectionKey;
    onSelect: (key: SectionKey) => void;
    onEdit: () => void;
    projectId: number;
    unitTypesCount: number;
    exteriorCount: number;
    interiorCount: number;
    siteplanCount: number;
}

const ShowSidebar: React.FC<ShowSidebarProps> = ({
    activeSection,
    onSelect,
    onEdit,
    projectId,
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
    ];

    return (
        <div className="w-64 flex-shrink-0 sticky top-4 flex flex-col gap-2">
            {/* Back */}
            <Link href={route("developer-projects.index")}>
                <div className="flex items-center gap-4 p-2 rounded-md bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <ArrowLeft size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-600 font-medium">Back</span>
                </div>
            </Link>

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
                <Link
                    href={route("developer-projects.expose-config.show", projectId)}
                >
                    <Button icon={<Settings2 size={14} />} block>
                        Configure Expose
                    </Button>
                </Link>
            </div>
        </div>
    );
};

export default ShowSidebar;
