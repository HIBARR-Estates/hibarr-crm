import React from "react";
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
    Gift,
} from "lucide-react";
import type { SectionKey } from "../Show";
import { usePermission } from "@/lib/permissionUtils";

interface ShowSidebarProps {
    activeSection: SectionKey;
    onSelect: (key: SectionKey) => void;
    onClose?: () => void;
    onEdit: () => void;
    availabilityLink?: string | null;
    unitTypesCount: number;
    exteriorCount: number;
    interiorCount: number;
    siteplanCount: number;
}

const ShowSidebar: React.FC<ShowSidebarProps> = ({
    activeSection,
    onSelect,
    onClose,
    onEdit,
    availabilityLink,
    unitTypesCount,
    exteriorCount,
    interiorCount,
    siteplanCount,
}) => {
    const { hasPermission } = usePermission();
    const canEdit = hasPermission("edit_developer_projects");
    const navItems: {
        key: SectionKey;
        icon: React.ReactNode;
        label: string;
        externalUrl?: string;
        disabled?: boolean;
    }[] = [
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
        {
            key: "pricelist",
            icon: <DollarSign size={16} />,
            label: "Price List",
            externalUrl: availabilityLink ?? undefined,
            disabled: !availabilityLink,
        },
        { key: "pdf", icon: <FileText size={16} />, label: "PDF Files" },
        // { key: "offers", icon: <Gift size={16} />, label: "Offers" },
    ];

    return (
        <div className="w-full lg:w-64 lg:flex-shrink-0 lg:sticky lg:top-4 flex flex-col gap-2">
            {/* Nav items – each is its own card */}
            {navItems.map((item) => {
                const isDisabled = Boolean(item.disabled);
                const isActive = activeSection === item.key;
                const baseClasses = `flex items-center gap-4 p-2 rounded-md border transition-colors ${
                    isDisabled
                        ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                        : isActive
                          ? "bg-[#1a2a6c] text-white border-[#1a2a6c] cursor-pointer"
                          : "bg-white border-gray-200 text-gray-700 cursor-pointer hover:bg-gray-50"
                }`;

                if (item.externalUrl && !isDisabled) {
                    return (
                        <a
                            key={item.key}
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={baseClasses}
                            title="Open availability link"
                            onClick={() => onClose?.()}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            <span className="text-sm font-medium">
                                {item.label}
                            </span>
                        </a>
                    );
                }

                return (
                    <div
                        key={item.key}
                        onClick={() => {
                            if (!isDisabled) {
                                onSelect(item.key);
                                onClose?.();
                            }
                        }}
                        className={baseClasses}
                        title={
                            item.key === "pricelist" && isDisabled
                                ? "Availability link absent"
                                : undefined
                        }
                    >
                        <span className="flex-shrink-0">{item.icon}</span>
                        <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">
                                {item.label}
                            </span>
                            {item.key === "pricelist" && isDisabled && (
                                <span className="text-xs">
                                    Availability link absent
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
                {canEdit && (
                    <Button icon={<Pencil size={14} />} block onClick={onEdit}>
                        Edit Project
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ShowSidebar;
