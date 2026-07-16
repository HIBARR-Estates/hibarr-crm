import React, { useEffect, useRef } from "react";
import GeneralCustomFieldTab from "@/Components/Common/GeneralCustomFieldTab";
import { LeadFormProps } from "./LeadForm";
import { Button, Form, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";

interface CustomFieldTabProps
    extends Pick<
        LeadFormProps,
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
    customFields?: any[];
    onUserEdit?: () => void;
    formId?: string;
    hideFooter?: boolean;
}

const CustomFieldTab: React.FC<CustomFieldTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText = "Save Contact",
    cancelText = "Cancel",
    categoryId,
    categoryName,
    customFields,
    onUserEdit,
    formId,
    hideFooter = false,
}) => {
    const [form] = Form.useForm();
    const isPopulatingRef = useRef(false);

    useEffect(() => {
        if (data) {
            isPopulatingRef.current = true;
            form.setFieldsValue(data);
            queueMicrotask(() => {
                isPopulatingRef.current = false;
            });
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
        <Form
            id={formId}
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={() => {
                if (!isPopulatingRef.current) {
                    onUserEdit?.();
                }
            }}
        >
            <section className="save-lead-form__section">
                <h3 className="save-lead-form__section-title">
                    {categoryName}
                </h3>
                <GeneralCustomFieldTab
                    data={data}
                    setData={() => {}}
                    errors={{}}
                    categoryId={categoryId}
                    categoryName={categoryName}
                    customFields={customFields}
                />

                {!hideFooter && (
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
                )}
            </section>
        </Form>
    );
};

export default CustomFieldTab;
