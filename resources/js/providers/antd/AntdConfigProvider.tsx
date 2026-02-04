import { ConfigProvider, App } from "antd";
import { usePage } from "@inertiajs/react";
import { antdMainThemeConfig } from "./utils";

// Ant Design locale imports
import enUS from "antd/locale/en_US";
import arEG from "antd/locale/ar_EG";
import ruRU from "antd/locale/ru_RU";
import trTR from "antd/locale/tr_TR";
import deDE from "antd/locale/de_DE";
import faIR from "antd/locale/fa_IR";
import type { Locale } from "antd/es/locale";

// Map locale codes to Ant Design locale objects
const ANTD_LOCALES: Record<string, Locale> = {
    en: enUS,
    ar: arEG,
    ru: ruRU,
    tr: trTR,
    de: deDE,
    fa: faIR,
};

const AntdConfigProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { props } = usePage();
    const locale = (props.locale as string) || "en";
    const isRtl = (props.isRtl as boolean) || false;

    // Get the appropriate Ant Design locale, fallback to English
    const antdLocale = ANTD_LOCALES[locale] || enUS;

    return (
        <ConfigProvider
            theme={antdMainThemeConfig}
            locale={antdLocale}
            direction={isRtl ? "rtl" : "ltr"}
        >
            <App>{children}</App>
        </ConfigProvider>
    );
};

export default AntdConfigProvider;
