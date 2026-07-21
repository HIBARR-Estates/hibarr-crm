import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import DealBadge from "../primitives/DealBadge";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import type { DealInfoSectionId } from "../../types";

interface SidebarItem {
    id: DealInfoSectionId;
    label: string;
    icon: string;
    badge?: string;
    badgeVariant: "blue" | "gray";
    later?: boolean;
    searchTerms?: string[];
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
    const { td } = useTd();
    const { t } = useTranslation();
    const [search, setSearch] = useState("");

    const query = search.trim().toLowerCase();
    const filteredGroups = useMemo(() => {
        if (!query) return navGroups;
        return navGroups
            .map((group) => ({
                ...group,
                items: group.items.filter(
                    (item) =>
                        item.label.toLowerCase().includes(query) ||
                        (item.searchTerms ?? []).some((term) =>
                            term.toLowerCase().includes(query),
                        ),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [navGroups, query]);
    const hasNoMatches = query.length > 0 && filteredGroups.length === 0;

    return (
        <aside
            className="min-h-[500px] pt-0.5"
            style={{ borderRight: `1px solid ${T.BORDER}` }}
        >
            <div className="dr-label px-2.5 pb-1 pt-2.5" style={{ fontSize: 11 }}>
                {t("pages.deals.sidebar.title")}
            </div>
            <div className="px-2.5 pb-2">
                <input
                    className="dr-input"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("pages.deals.sidebar.search_placeholder")}
                    aria-label={t("pages.deals.sidebar.search_aria")}
                    style={{ fontSize: 12, padding: "6px 9px" }}
                />
            </div>
            {hasNoMatches && (
                <div
                    className="px-2.5 py-1.5 text-xs italic"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {t("pages.deals.sidebar.no_match")} "{search}"
                </div>
            )}
            {filteredGroups.map((group) => (
                <div key={group.label}>
                    <div
                        className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.05em]"
                        style={{ color: T.TEXT_HINT }}
                    >
                        {td(group.label)}
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
                                    {td(item.label)}
                                </span>
                                {item.badge != null && (
                                    <DealBadge variant={item.badgeVariant}>
                                        {td(item.badge)}
                                    </DealBadge>
                                )}
                            </button>
                        );
                    })}
                </div>
            ))}
        </aside>
    );
}
