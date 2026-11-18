import React from "react";
import { Typography } from "antd";
import { CustomField } from "@/Types";
import CustomFieldRenderer from "@/Components/CustomFieldRenderer";
import { useTd } from "@/Hooks/useDynamicTranslation";
// import CustomFieldRenderer from '@/Components/CustomFieldRenderer';

const { Title } = Typography;

interface Props {
    form: any;
    fields: CustomField[];
}

const CustomFieldTab: React.FC<Props> = ({ form, fields }) => {
    const { td } = useTd();
    if (!fields || fields.length === 0) {
        return (
            <div>
                <Title level={4} className="mb-6">
                    {td("Custom Fields", { source: "en" })}
                </Title>
                <p className="text-gray-500">{td("No custom fields configured.", { source: "en" })}</p>
            </div>
        );
    }

    return (
        <div>
            <Title level={4} className="mb-6">
                {td("Custom Fields", { source: "en" })}
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
