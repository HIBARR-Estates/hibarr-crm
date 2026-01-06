import React from "react";
import { Card } from "antd";
import GeneralCustomFieldTab from "@/Components/Common/GeneralCustomFieldTab";

interface StepCustomFieldsProps {
    categoryId: number;
    categoryName: string;
    data?: any;
}

const StepCustomFields: React.FC<StepCustomFieldsProps> = ({
    categoryId,
    categoryName,
    data,
}) => {
    if (!categoryId) return null;

    return (
        <div className={`step-custom-fields-${categoryId}`}>
            <h4 className="text-lg font-medium mb-4">{categoryName}</h4>
            <GeneralCustomFieldTab
                data={data}
                setData={() => {}} // Handled by Form context
                errors={{}}
                categoryId={categoryId}
                categoryName={categoryName}
            />
        </div>
    );
};

export default StepCustomFields;
