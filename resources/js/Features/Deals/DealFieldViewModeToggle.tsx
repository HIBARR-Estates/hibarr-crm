import React from "react";
import { Segmented, Tooltip } from "antd";
import { EyeOutlined, FilterOutlined } from "@ant-design/icons";
import useTranslation from "@/Hooks/useTranslation";
import { DealFieldViewMode } from "./useDealFieldViewMode";

interface Props {
    mode: DealFieldViewMode;
    onChange: (mode: DealFieldViewMode) => void;
    size?: "small" | "middle" | "large";
    className?: string;
}

const DealFieldViewModeToggle: React.FC<Props> = ({
    mode,
    onChange,
    size = "small",
    className,
}) => {
    const { t } = useTranslation();

    return (
        <Tooltip title={t("pages.deals.info.field_view_all_hint")}>
            <Segmented
                size={size}
                className={className}
                value={mode}
                onChange={(value) => onChange(value as DealFieldViewMode)}
                options={[
                    {
                        label: t("pages.deals.info.field_view_scoped"),
                        value: "scoped",
                        icon: <FilterOutlined />,
                    },
                    {
                        label: t("pages.deals.info.field_view_all"),
                        value: "all",
                        icon: <EyeOutlined />,
                    },
                ]}
            />
        </Tooltip>
    );
};

export default DealFieldViewModeToggle;
