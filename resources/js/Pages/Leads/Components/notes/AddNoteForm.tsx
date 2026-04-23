import React from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Card, Form, Input, Button, App, Alert } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { errorFormatter } from "@/lib/api/utils/common";
import HtmlEditor from "@/Components/HtmlEditor";
import { LeadNote } from "@/Types/api/lead-note";
import { Lead } from "@/Types/api/leads";

interface SaveNoteFormData {
    title: string;
    details: string;
    lead_id: number;
}

interface AddNoteFormProps {
    lead: Lead;
    onCancel: () => void;
}

export const AddNoteForm: React.FC<AddNoteFormProps> = ({ lead, onCancel }) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [errors, setErrors] = React.useState<string[]>([]);

    // Custom validator for HTML content
    const validateHtmlContent = (_: any, value: string) => {
        const textContent = (value || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        if (!textContent || textContent === "") {
            return Promise.reject(new Error(t("pages.leads.notes.rule_details")));
        }
        return Promise.resolve();
    };

    // Add note mutation
    const addNoteMutation = useApiMutate<
        SaveNoteFormData,
        LeadNote,
        ApiResponse<LeadNote>
    >(route("lead-notes.store"), "POST", (response) => {
        if (response?.status === "success") {
            message.success("Note created successfully!");
            setErrors([]);
            form.resetFields();
            router.reload();
            onCancel();
        }
    });

    const handleSaveNote = (values: any) => {
        const submitData: SaveNoteFormData = {
            title: values.title,
            details: values.details,
            lead_id: lead.id,
        };

        addNoteMutation.mutate(submitData, {
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors(Object.values(responseErrors).flat());
            },
        });
    };

    const handleCancel = () => {
        form.resetFields();
        setErrors([]);
        onCancel();
    };

    return (
        <div className="">
            <Card variant="outlined">
                <div className="mb-6 flex items-center">
                    <Button
                        type="text"
                        size="small"
                        icon={<ArrowLeftOutlined />}
                        onClick={handleCancel}
                        className="text-gray-600 hover:text-gray-800 -ml-2"
                    />
                    <span className="text-lg font-medium ml-2 text-gray-500">
                        {t("pages.leads.notes.add_new_title")}
                    </span>
                </div>

                {errors.length > 0 && (
                    <Alert
                        type="error"
                        message={t("pages.leads.notes.errors_title")}
                        description={
                            <ul className="mt-2">
                                {errors.map((error, index) => (
                                    <li key={index} className="text-red-600">
                                        {error}
                                    </li>
                                ))}
                            </ul>
                        }
                        className="mb-6"
                        closable
                        onClose={() => setErrors([])}
                    />
                )}

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveNote}
                    className="space-y-6"
                >
                    <Form.Item
                        name="title"
                        label={t("pages.leads.notes.label_title")}
                        rules={[
                            {
                                required: true,
                                message: t("pages.leads.notes.rule_title"),
                            },
                        ]}
                        className="mb-6"
                    >
                        <Input
                            placeholder={t("pages.leads.notes.placeholder_title")}
                            disabled={isLoading({
                                status: addNoteMutation.status,
                            })}
                            className="text-lg py-3"
                            autoFocus
                        />
                    </Form.Item>

                    <Form.Item
                        name="details"
                        label={t("pages.leads.notes.label_content")}
                        rules={[
                            {
                                required: true,
                                validator: validateHtmlContent,
                            },
                        ]}
                        className="mb-6"
                    >
                        <HtmlEditor
                            placeholder={t("pages.leads.notes.placeholder_content_add")}
                            disabled={isLoading({
                                status: addNoteMutation.status,
                            })}
                            height={300}
                        />
                    </Form.Item>

                    <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-100">
                        <Button
                            onClick={handleCancel}
                            disabled={isLoading({
                                status: addNoteMutation.status,
                            })}
                        >
                            {t("pages.leads.notes.btn_cancel")}
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isLoading({
                                status: addNoteMutation.status,
                            })}
                            icon={<SaveOutlined />}
                        >
                            {t("pages.leads.notes.btn_save")}
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};
