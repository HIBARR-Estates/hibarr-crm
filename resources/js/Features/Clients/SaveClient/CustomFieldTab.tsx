import React from "react";
import { Typography } from "antd";
import { CustomField } from "@/Types";
import CustomFieldRenderer from "@/Components/CustomFieldRenderer";
// import CustomFieldRenderer from '@/Components/CustomFieldRenderer';

const { Title } = Typography;

interface Props {
    form: any;
    fields: CustomField[];
}

const CustomFieldTab: React.FC<Props> = ({ form, fields }) => {
    if (!fields || fields.length === 0) {
        return (
            <div>
                <Title level={4} className="mb-6">
                    Custom Fields
                </Title>
                <p className="text-gray-500">No custom fields configured.</p>
            </div>
        );
    }

    return (
        <div>
            <Title level={4} className="mb-6">
                Custom Fields
            </Title>
            <CustomFieldRenderer
                fields={fields}
                form={form}
                namePrefix="custom_fields_data"
            />
        </div>
    );
};

export default CustomFieldTab;
