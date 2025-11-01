import { ThemeConfig, theme } from "antd";

export const THEME_COLOR = {
    primary: "#1890ff", // Ant Design default primary color
};

export const antdMainThemeConfig: ThemeConfig = {
    cssVar: true,

    // algorithm: theme.darkAlgorithm,

    token: {
        colorPrimary: THEME_COLOR.primary,
        // Override link colors to use our custom styling
        colorLink: "#111827", // text-gray-900 equivalent
        colorLinkHover: "#2563eb", // text-blue-600 equivalent
        colorLinkActive: "#2563eb", // text-blue-600 equivalent
    },
    components: {
        // Override Typography component link styling
        Typography: {
            colorLink: "#111827", // text-gray-900
            colorLinkHover: "#2563eb", // text-blue-600
            colorLinkActive: "#2563eb", // text-blue-600
        },
        // Override Table component link styling
        Table: {
            colorLink: "#111827", // text-gray-900
            colorLinkHover: "#2563eb", // text-blue-600
            colorLinkActive: "#2563eb", // text-blue-600
        },
    },
};
