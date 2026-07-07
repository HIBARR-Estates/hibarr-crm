import DealBadge from "../primitives/DealBadge";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import type { DealInfoSectionId } from "../../types";

interface SidebarItem {
    id: DealInfoSectionId;
    label: string;
    icon: string;
    badge: string;
    badgeVariant: "blue" | "gray";
    later?: boolean;
}

interface NavGroup {
    label: string;
    items: SidebarItem[];
}

interface DealInfoSidebarProps {
    navGroups: NavGroup[];
    activeSection: DealInfoSectionId;
    onSectionChange: (section: DealInfoSectionId) => void;
}

export default function DealInfoSidebar({
    navGroups,
    activeSection,
    onSectionChange,
}: DealInfoSidebarProps) {
    return (
        <aside
            className="min-h-[500px] pt-0.5"
            style={{ borderRight: `1px solid ${T.BORDER}` }}
        >
            {navGroups.map((group) => (
                <div key={group.label}>
                    <div
                        className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.05em]"
                        style={{ color: T.TEXT_HINT }}
                    >
                        {group.label}
                    </div>
                    {group.items.map((item) => {
                        const isActive = item.id === activeSection;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSectionChange(item.id)}
                                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left"
                                style={{
                                    fontSize: 13,
                                    background: isActive ? T.BLUE_LIGHT : "transparent",
                                    color: isActive
                                        ? T.BLUE
                                        : item.later
                                          ? T.TEXT_HINT
                                          : T.TEXT_MUTED,
                                    fontWeight: isActive ? 500 : 400,
                                    borderLeft: `2px solid ${isActive ? T.BLUE : "transparent"}`,
                                    opacity: item.later ? 0.7 : 1,
                                }}
                            >
                                <span className="flex items-center gap-1.5">
                                    <DealIcon
                                        name={item.icon}
                                        size={14}
                                        color={
                                            isActive ? T.BLUE : T.TEXT_MUTED
                                        }
                                    />
                                    {item.label}
                                </span>
                                <DealBadge variant={item.badgeVariant}>
                                    {item.badge}
                                </DealBadge>
                            </button>
                        );
                    })}
                </div>
            ))}
        </aside>
    );
}
