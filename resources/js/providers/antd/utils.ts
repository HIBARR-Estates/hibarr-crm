import { ThemeConfig, theme } from "antd";

export const THEME_COLOR = {
    primary: "#1890ff", // Ant Design default primary color
};
export const antdMainThemeConfig: ThemeConfig = {
    cssVar: true,

    // algorithm: theme.darkAlgorithm,

    token: {
        colorPrimary: THEME_COLOR.primary,
    },
    components: {},
};
