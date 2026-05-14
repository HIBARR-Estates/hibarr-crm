import React, { useState } from "react";
import { Tooltip } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";

const CONNECTORS = new Set([
    "&", "and", "or", "of", "the", "to", "a", "an", "in", "at", "for",
]);

function computeAbbrev(label: string): string {
    const words = label
        .split(/\s+/)
        .filter((w) => w.length > 0 && !CONNECTORS.has(w.toLowerCase()));
    if (words.length === 0) return (label[0] ?? "?").toUpperCase();
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export interface SideNavItem {
    key: string;
    label: string;
    abbrev?: string;
}

interface SideNavTabsProps {
    items: SideNavItem[];
    activeKey: string;
    onChange: (key: string) => void;
}

export default function SideNavTabs({
    items,
    activeKey,
    onChange,
}: SideNavTabsProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className={`flex flex-col border-r border-gray-100 bg-white shrink-0 transition-all duration-200 ${
                collapsed ? "w-11" : "w-44"
            }`}
        >
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
                {items.map((item) => {
                    const abbrev = item.abbrev ?? computeAbbrev(item.label);
                    const isActive = item.key === activeKey;

                    const btn = (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => onChange(item.key)}
                            className={`w-full flex items-center gap-2 px-2 py-2 text-left border-l-2 transition-colors duration-150 ${
                                isActive
                                    ? "border-blue-600 bg-blue-50 text-blue-700"
                                    : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        >
                            <span
                                className={`shrink-0 inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold tracking-wide ${
                                    isActive
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-100 text-gray-500"
                                }`}
                            >
                                {abbrev}
                            </span>
                            {!collapsed && (
                                <span className="truncate text-xs font-medium leading-tight">
                                    {item.label}
                                </span>
                            )}
                        </button>
                    );

                    return collapsed ? (
                        <Tooltip
                            key={item.key}
                            title={item.label}
                            placement="right"
                        >
                            {btn}
                        </Tooltip>
                    ) : (
                        <React.Fragment key={item.key}>{btn}</React.Fragment>
                    );
                })}
            </nav>

            <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="flex items-center justify-center py-2 border-t border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150 shrink-0"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? (
                    <MenuUnfoldOutlined className="text-xs" />
                ) : (
                    <MenuFoldOutlined className="text-xs" />
                )}
            </button>
        </div>
    );
}
