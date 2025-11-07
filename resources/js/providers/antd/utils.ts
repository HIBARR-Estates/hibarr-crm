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
        // Input border colors for better contrast on white background
        colorBorder: "#d1d5db", // gray-300 - default border color
        colorBorderSecondary: "#e5e7eb", // gray-200 - lighter border
        // colorBgContainer: "green",
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
        // Input component styling for better contrast
        Input: {
            colorBorder: "#d1d5db", // gray-300 - normal state
            // colorBorderHover: "#9ca3af", // gray-400 - hover state
            // colorBorderFocus: "#2563eb", // blue-600 - focus state
            activeBorderColor: "#2563eb", // blue-600 - active state
        },
        // Select component styling
        Select: {
            colorBorder: "#d1d5db", // gray-300 - normal state
            // colorBorderHover: "#9ca3af", // gray-400 - hover state
            // colorBorderFocus: "#2563eb", // blue-600 - focus state
            activeBorderColor: "#2563eb", // blue-600 - active state
        },
        // TextArea component styling
        // TextArea: {
        //     colorBorder: "#d1d5db", // gray-300 - normal state
        //     // colorBorderHover: "#9ca3af", // gray-400 - hover state
        //     // colorBorderFocus: "#2563eb", // blue-600 - focus state
        //     activeBorderColor: "#2563eb", // blue-600 - active state
        // },
        // DatePicker component styling
        DatePicker: {
            colorBorder: "#d1d5db", // gray-300 - normal state
            // colorBorderHover: "#9ca3af", // gray-400 - hover state
            // colorBorderFocus: "#2563eb", // blue-600 - focus state
            activeBorderColor: "#2563eb", // blue-600 - active state
        },
        // TimePicker component styling
        // TimePicker: {
        //     colorBorder: "#d1d5db", // gray-300 - normal state
        //     colorBorderHover: "#9ca3af", // gray-400 - hover state
        //     // colorBorderFocus: "#2563eb", // blue-600 - focus state
        //     activeBorderColor: "#2563eb", // blue-600 - active state
        // },
        // InputNumber component styling
        InputNumber: {
            colorBorder: "#d1d5db", // gray-300 - normal state
            // colorBorderHover: "#9ca3af", // gray-400 - hover state
            // colorBorderFocus: "#2563eb", // blue-600 - focus state
            activeBorderColor: "#2563eb", // blue-600 - active state
        },
    },
};
