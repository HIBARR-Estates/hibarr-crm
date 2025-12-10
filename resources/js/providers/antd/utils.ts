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
        // Increase input heights for better usability
        controlHeight: 40, // Default height increased from 32px to 40px
        controlHeightSM: 32, // Small size increased from 24px to 32px
        controlHeightLG: 48, // Large size increased from 40px to 48px
        // Adjust padding for better proportions with increased height
        paddingContentHorizontal: 12, // Horizontal padding
        paddingContentVertical: 8, // Vertical padding
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
            controlHeight: 40, // Ensure consistent height
            controlHeightSM: 32,
            controlHeightLG: 48,
        },
        // Select component styling
        Select: {
            colorBorder: "#d1d5db", // gray-300 - normal state
            // colorBorderHover: "#9ca3af", // gray-400 - hover state
            // colorBorderFocus: "#2563eb", // blue-600 - focus state
            activeBorderColor: "#2563eb", // blue-600 - active state
            controlHeight: 40, // Ensure consistent height
            controlHeightSM: 32,
            controlHeightLG: 48,
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
            controlHeight: 40, // Ensure consistent height
            controlHeightSM: 32,
            controlHeightLG: 48,
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
            controlHeight: 40, // Ensure consistent height
            controlHeightSM: 32,
            controlHeightLG: 48,
        },
        // Button component styling for consistent height
        Button: {
            controlHeight: 40, // Match input height for visual consistency
            controlHeightSM: 32,
            controlHeightLG: 48,
            paddingContentHorizontal: 16, // Slightly more padding for buttons
        },
        // Form component styling
        Form: {
            itemMarginBottom: 20, // Increase spacing between form items
        },
        // Card component styling for better content spacing
        Card: {
            paddingLG: 24, // Large card padding
            padding: 20, // Default card padding
            paddingSM: 16, // Small card padding
            paddingXS: 12, // Extra small card padding

            // increase card content padding
            bodyPaddingSM: 20,
            bodyPadding: 26,
            // increase card content padding
            // headerBg: "#aaa", // gray-50 for header background
            boxShadow: "none",
            boxShadowTertiary: "none",
        },
        Collapse: {
            paddingLG: 24, // Large card padding
            padding: 20, // Default card padding
            paddingSM: 16, // Small card padding
            paddingXS: 12, // Extra small card padding

            contentPadding: 26,

            // increase card content padding
            // bodyPaddingSM: 20,
            // bodyPadding: 26,
            // increase card content padding
            headerBg: "#fff", // gray-50 for header background
            // contentPaddingHorizontal: 16,
            // contentPaddingVertical: 12,
        },
    },
};
