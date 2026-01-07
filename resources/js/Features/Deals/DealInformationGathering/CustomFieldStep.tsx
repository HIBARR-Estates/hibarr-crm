import React, { useEffect } from "react";
import { Form, Button, Divider, Skeleton } from "antd";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";

import CustomFieldRenderer from "@/Components/CustomFieldRenderer";

// Wrapper because I need to import CustomFieldRenderer
const CustomFieldRendererWrapper = ({ fields, form }: any) => {
    return (
        <CustomFieldRenderer
            fields={fields}
            form={form}
            namePrefix="custom_fields_data"
        />
    );
};

interface CustomFieldStepProps {
    deal: any;
    stepConfig: {
        id: number;
        title: string;
        fields: any[];
    };
    onNext: () => void;
    onPrev: () => void;
    isLast: boolean;
}

const CustomFieldStep: React.FC<CustomFieldStepProps> = ({
    deal,
    stepConfig,
    onNext,
    onPrev,
    isLast,
}) => {
    const [form] = Form.useForm();

    // Fetch existing custom fields data for this deal
    const { data: customFieldsResponse, status: fetchStatus } = useApiQuery<{
        status: string;
        custom_fields_data: Record<string, any>;
    }>({
        path: route("deals.gathering.get_custom_fields", { id: deal?.id }),
        // enabled: !!deal?.id,
    });

    const { mutate, status } = useApiMutate<
        { custom_fields_data: any },
        any,
        ApiResponse<any>
    >(route("deals.gathering.update_step", { id: deal.id }), "PATCH");

    const loading = isLoading({ status });
    const loadingData = isLoading({ status: fetchStatus });

    // Pre-populate form with existing custom fields data
    useEffect(() => {
        if (customFieldsResponse?.custom_fields_data) {
            const existingData = customFieldsResponse.custom_fields_data;
            // Transform the data to match form structure: { custom_fields_data: { field_X: value } }
            if (Object.keys(existingData).length > 0) {
                form.setFieldsValue({
                    custom_fields_data: existingData,
                });
            }
        }
    }, [customFieldsResponse, form]);

    const onFinish = (values: any) => {
        mutate(
            { custom_fields_data: values.custom_fields_data },
            {
                onSuccess: () => {
                    onNext();
                },
            }
        );
    };

    return (
        <Skeleton loading={loadingData} active paragraph={{ rows: 6 }}>
            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
                <div className="mb-8">
                    <h3 className="text-2xl font-semibold text-gray-800">
                        {stepConfig.title}
                    </h3>
                    <p className="text-gray-500 mt-1">
                        Please fill in the details below
                    </p>
                    <Divider className="my-4" />
                </div>

                <div className="py-2">
                    <CustomFieldRendererWrapper
                        fields={stepConfig.fields}
                        form={form}
                    />
                </div>

                <Divider className="my-8" />

                <div className="flex justify-between items-center">
                    <Button onClick={onPrev} className="px-6">
                        Back
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        className="px-8 h-12 text-base font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
                    >
                        {isLast ? "Finish" : "Continue"}
                    </Button>
                </div>
            </Form>
        </Skeleton>
    );
};

export default CustomFieldStep;
