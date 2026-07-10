import DealInfoSectionShell from "../deal-info/DealInfoSectionShell";
import DealBadge from "../primitives/DealBadge";
import DealIcon from "../primitives/DealIcon";
import { DealInfoSectionId } from "../../types";

interface DealInfoTabProps {
    activeSection: DealInfoSectionId;
    onSectionChange: (section: DealInfoSectionId) => void;
}

interface NavItem {
    id: DealInfoSectionId;
    label: string;
    icon: string;
    badge: string;
    badgeVariant: "blue" | "gray";
}

const SECTION_META: Record<DealInfoSectionId, { title: string; subtitle: string }> = {
    general: {
        title: "General info",
        subtitle: "Core profile details and qualification context for this deal.",
    },
    experience: {
        title: "Investment experience",
        subtitle: "Investor background, strategy familiarity, and prior transaction comfort.",
    },
    property: {
        title: "Property preferences",
        subtitle: "Target property characteristics and filtering preferences.",
    },
    income: {
        title: "Income and savings",
        subtitle: "Financial readiness indicators and budget confidence markers.",
    },
    location: {
        title: "Location preferences",
        subtitle: "Geographic constraints and market focus preferences.",
    },
    preftimeline: {
        title: "Preferences and timeline",
        subtitle: "Decision horizon and purchase timing assumptions.",
    },
    funding: {
        title: "Funding and liquidity",
        subtitle: "Financing posture and available liquidity details.",
    },
    support: {
        title: "Support and collaboration",
        subtitle: "Stakeholders, advisors, and collaboration expectations.",
    },
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
    {
        label: "Now - in progress",
        items: [
            { id: "general", label: "General info", icon: "info", badge: "--", badgeVariant: "blue" },
            { id: "experience", label: "Inv. experience", icon: "award", badge: "--", badgeVariant: "blue" },
            { id: "property", label: "Property pref.", icon: "building", badge: "--", badgeVariant: "blue" },
            { id: "income", label: "Income & savings", icon: "wallet", badge: "--", badgeVariant: "blue" },
        ],
    },
    {
        label: "Later stages",
        items: [
            { id: "location", label: "Location pref.", icon: "map-pin", badge: "Prospect", badgeVariant: "gray" },
            { id: "preftimeline", label: "Pref. & timeline", icon: "clock", badge: "Prospect", badgeVariant: "gray" },
            { id: "funding", label: "Funding & liquidity", icon: "bank", badge: "Customer", badgeVariant: "gray" },
            { id: "support", label: "Support & collab.", icon: "lifebuoy", badge: "Customer", badgeVariant: "gray" },
        ],
    },
];

export default function DealInfoTab({ activeSection, onSectionChange }: DealInfoTabProps) {
    const section = SECTION_META[activeSection] ?? SECTION_META.general;

    return (
        <div className="grid gap-[18px] xl:grid-cols-[210px_1fr]">
            <aside className="space-y-3 rounded-[12px] border border-[#e2e5ea] bg-white p-3">
                {NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                        <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b95a7]">
                            {group.label}
                        </div>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isActive = item.id === activeSection;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left"
                                        style={{
                                            background: isActive ? "#eff4fb" : "transparent",
                                            border: `1px solid ${isActive ? "#d7e6fa" : "transparent"}`,
                                        }}
                                        onClick={() => onSectionChange(item.id)}
                                    >
                                        <span className="flex items-center gap-2 text-xs">
                                            <DealIcon name={item.icon} size={14} color={isActive ? "#1a6bb5" : "#6b7280"} />
                                            <span style={{ color: isActive ? "#0f172a" : "#374151", fontWeight: isActive ? 500 : 400 }}>
                                                {item.label}
                                            </span>
                                        </span>
                                        <DealBadge variant={item.badgeVariant}>{item.badge}</DealBadge>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </aside>

            <DealInfoSectionShell title={section.title} subtitle={section.subtitle} />
        </div>
    );
}
