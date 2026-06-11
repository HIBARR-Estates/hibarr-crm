import React from "react";
import { Lead } from "@/Types/api/leads";
import { Tag } from "antd";
import { MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { formatMobileForDisplay } from "@/lib/utils";

interface LeadQualificationHeaderProps {
    lead: Lead;
}

const LeadQualificationHeader: React.FC<LeadQualificationHeaderProps> = ({
    lead,
}) => {
    const mobile = formatMobileForDisplay(lead.mobile);

    return (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <UserOutlined className="text-gray-400" />
                        {lead.client_name}
                    </h2>
                    {lead.company_name && (
                        <p className="text-sm text-gray-500 mt-0.5">
                            {lead.company_name}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    {lead.client_email && (
                        <span className="flex items-center gap-1.5">
                            <MailOutlined className="text-gray-400" />
                            {lead.client_email}
                        </span>
                    )}
                    {mobile && (
                        <span className="flex items-center gap-1.5">
                            <PhoneOutlined className="text-gray-400" />
                            {mobile}
                        </span>
                    )}
                    {lead.lead_lifecycle_status && (
                        <Tag color={lead.lead_lifecycle_status.label_color}>
                            {lead.lead_lifecycle_status.label}
                        </Tag>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadQualificationHeader;
