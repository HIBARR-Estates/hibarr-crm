import React from "react";
import { Dropdown, Button, Space } from "antd";
import { GlobalOutlined, CheckOutlined, DownOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useTranslation } from "@/Hooks/useTranslation";
import type { SupportedLocale } from "@/lib/i18n";
import { LOCALE_FLAG_EMOJI } from "@/lib/localeFlags";

const FLAG_EMOJI = LOCALE_FLAG_EMOJI;

interface LanguageSwitcherProps {
    /** Show only icon when true */
    compact?: boolean;
    /** Custom class name */
    className?: string;
    /** Applied to the flag + native-name cluster (e.g. hide below lg). */
    labelClassName?: string;
}

/**
 * Language Switcher Component
 * Displays a dropdown to change the application language
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
    compact = false,
    className = "",
    labelClassName = "",
}) => {
    const { locale, availableLocales, changeLanguage, t } = useTranslation();

    // Build menu items from available locales
    const items: MenuProps["items"] = Object.entries(availableLocales).map(
        ([code, lang]) => ({
            key: code,
            label: (
                <Space className="w-full justify-between">
                    <Space>
                        <span className="text-base">
                            {FLAG_EMOJI[lang.flag] || "🌐"}
                        </span>
                        <span>{lang.native}</span>
                        {lang.name !== lang.native && (
                            <span className="text-gray-400 text-xs">
                                ({lang.name})
                            </span>
                        )}
                    </Space>
                    {code === locale && (
                        <CheckOutlined className="text-blue-500" />
                    )}
                </Space>
            ),
            onClick: () => {
                if (code !== locale) {
                    changeLanguage(code as SupportedLocale);
                }
            },
        }),
    );

    const currentLang = availableLocales[locale];
    const currentFlag = currentLang
        ? FLAG_EMOJI[currentLang.flag] || "🌐"
        : "🌐";

    return (
        <Dropdown
            menu={{
                items,
                selectedKeys: [locale],
            }}
            trigger={["click"]}
            placement="bottomRight"
        >
            <button
                type="button"
                className={`inline-flex items-center gap-1.5 h-11 px-3 rounded-lg text-[13px] font-medium text-[#374151] bg-transparent hover:bg-gray-100 transition-colors border-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
                style={{
                    height: "44px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#374151",
                    background: "transparent",
                    border: "none",
                }}
                aria-label={`Language: ${currentLang?.name || "English"}`}
            >
                <GlobalOutlined style={{ fontSize: 16 }} aria-hidden="true" />
                <span>{currentLang?.name || currentLang?.native || "English"}</span>
                <DownOutlined style={{ fontSize: 13, color: "#6b7280" }} aria-hidden="true" />
            </button>
        </Dropdown>
    );
};

export default LanguageSwitcher;
