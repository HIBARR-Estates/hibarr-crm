import React, { useState } from "react";
import { Badge, Typography } from "antd";
import { DownOutlined, RightOutlined } from "@ant-design/icons";

const { Title } = Typography;

interface FormSectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    /** Number of validation errors in this section */
    errorCount?: number;
    /** Extra content shown in the header (right side) */
    extra?: React.ReactNode;
    /** Section description shown under the title */
    description?: string;
}

/**
 * A collapsible card-style section for the property form.
 * Shows title with icon, optional error badge, and collapse toggle.
 */
const FormSection: React.FC<FormSectionProps> = ({
    title,
    icon,
    children,
    defaultOpen = true,
    errorCount = 0,
    extra,
    description,
}) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-gray-50/50 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-2.5">
                    {icon && (
                        <span className="text-blue-500 text-base">{icon}</span>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <Title
                                level={5}
                                className="!mb-0 !text-sm !font-semibold"
                            >
                                {title}
                            </Title>
                            {errorCount > 0 && (
                                <Badge
                                    count={errorCount}
                                    size="small"
                                    color="#ff4d4f"
                                />
                            )}
                        </div>
                        {description && (
                            <span className="text-xs text-gray-400 mt-0.5 block">
                                {description}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {extra}
                    <span className="text-gray-400 text-xs">
                        {open ? <DownOutlined /> : <RightOutlined />}
                    </span>
                </div>
            </div>
            {/* Content */}
            {open && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                    {children}
                </div>
            )}
        </div>
    );
};

export default FormSection;
