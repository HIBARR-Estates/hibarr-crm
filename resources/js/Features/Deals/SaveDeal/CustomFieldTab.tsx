import React, { useEffect } from "react";
import { Form, Button, Space, Card } from "antd";
import GeneralCustomFieldTab from "@/Components/Common/GeneralCustomFieldTab";
import { SaveOutlined } from "@ant-design/icons";
import { DealFormProps } from "./DealForm";

interface CustomFieldTabProps
    extends Pick<
        DealFormProps,
        | "onCancel"
        | "loading"
        | "submitText"
        | "cancelText"
        | "data"
        | "onSubmit"
        | "setErrors"
        | "onErrorsClear"
    > {
    categoryId: number;
    categoryName: string;
}

const CustomFieldTab: React.FC<CustomFieldTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText = "Save Deal",
    cancelText = "Cancel",
    categoryId,
    categoryName,
}) => {
    const [form] = Form.useForm();

    useEffect(() => {
        // Initialize form values when data changes
        if (data) {
            form.setFieldsValue(data);
        }
    }, [data, form]);

    const handleSubmit = (values: any) => {
        // Merge the custom fields data with existing data
        const formData = {
            ...data,
            ...values,
        };
        onSubmit(formData);
    };

    if (data === undefined) {
        return null;
    }

    return (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Card title={`${categoryName} Custom Fields`} size="small">
                <GeneralCustomFieldTab
                    data={data}
                    setData={(key, value) => {
                        // Update form fields when GeneralCustomFieldTab changes data
                        // if (key === "custom_fields_data") {
                        //     form.setFieldsValue({ [key]: value });
                        // }
                    }}
                    errors={{}}
                    categoryId={categoryId}
                    categoryName={categoryName}
                />

                <div style={{ marginTop: 24 }}>
                    <Space>
                        <Button onClick={onCancel}>{cancelText}</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<SaveOutlined />}
                        >
                            {submitText}
                        </Button>
                    </Space>
                </div>
            </Card>
        </Form>
    );
};

export default CustomFieldTab;
