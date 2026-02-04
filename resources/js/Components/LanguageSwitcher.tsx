import React from 'react';
import { Dropdown, Button, Space } from 'antd';
import { GlobalOutlined, CheckOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useTranslation } from '@/hooks/useTranslation';
import type { SupportedLocale } from '@/lib/i18n';

// Flag emoji mapping for better visual representation
const FLAG_EMOJI: Record<string, string> = {
    gb: '🇬🇧',
    ru: '🇷🇺',
    tr: '🇹🇷',
    de: '🇩🇪',
    ir: '🇮🇷',
    sa: '🇸🇦',
};

interface LanguageSwitcherProps {
    /** Show only icon when true */
    compact?: boolean;
    /** Custom class name */
    className?: string;
}

/**
 * Language Switcher Component
 * Displays a dropdown to change the application language
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
    compact = false,
    className = '',
}) => {
    const { locale, availableLocales, changeLanguage, t } = useTranslation();

    // Build menu items from available locales
    const items: MenuProps['items'] = Object.entries(availableLocales).map(
        ([code, lang]) => ({
            key: code,
            label: (
                <Space className="w-full justify-between">
                    <Space>
                        <span className="text-base">
                            {FLAG_EMOJI[lang.flag] || '🌐'}
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
        })
    );

    const currentLang = availableLocales[locale];
    const currentFlag = currentLang
        ? FLAG_EMOJI[currentLang.flag] || '🌐'
        : '🌐';

    return (
        <Dropdown
            menu={{
                items,
                selectedKeys: [locale],
            }}
            trigger={['click']}
            placement="bottomRight"
        >
            <Button
                icon={<GlobalOutlined />}
                className={className}
                type="text"
            >
                {!compact && (
                    <Space>
                        <span>{currentFlag}</span>
                        <span>{currentLang?.native || 'English'}</span>
                    </Space>
                )}
            </Button>
        </Dropdown>
    );
};

export default LanguageSwitcher;
