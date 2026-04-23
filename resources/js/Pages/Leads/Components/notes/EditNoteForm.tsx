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

interface UpdateNoteFormData {
    title: string;
    details: string;
}

interface EditNoteFormProps {
    lead: Lead;
    note: LeadNote;
    onCancel: () => void;
}

export const EditNoteForm: React.FC<EditNoteFormProps> = ({
    lead,
    note,
    onCancel,
}) => {
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

    // Update note mutation
    const updateNoteMutation = useApiMutate<
        UpdateNoteFormData,
        LeadNote,
        ApiResponse<LeadNote>
    >(route("lead-notes.update", note.id), "PUT", (response) => {
        if (response?.status === "success") {
            message.success(t("pages.leads.notes.updated_success"));
            setErrors([]);
            router.reload();
            onCancel();
        }
    });

    const handleUpdateNote = (values: any) => {
        const submitData: UpdateNoteFormData = {
            title: values.title,
            details: values.details,
        };

        updateNoteMutation.mutate(submitData, {
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors(Object.values(responseErrors).flat());
            },
        });
    };

    const handleCancel = () => {
        setErrors([]);
        onCancel();
    };

    // Set initial form values
    React.useEffect(() => {
        form.setFieldsValue({
            title: note.title,
            details: note.details || "",
        });
    }, [note, form]);

    return (
        <div className="">
            <Card
                variant="outlined"
                className="shadow-sm border border-gray-200"
                bodyStyle={{ padding: "32px" }}
            >
                <div className="mb-6">
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={handleCancel}
                        className="text-gray-600 hover:text-gray-800 -ml-2"
                    >
                        {t("pages.leads.notes.back_to_notes")}
                    </Button>
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
                    onFinish={handleUpdateNote}
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
                                status: updateNoteMutation.status,
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
                            placeholder={t("pages.leads.notes.placeholder_content_edit")}
                            disabled={isLoading({
                                status: updateNoteMutation.status,
                            })}
                            height={300}
                        />
                    </Form.Item>

                    <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-100">
                        <Button
                            onClick={handleCancel}
                            disabled={isLoading({
                                status: updateNoteMutation.status,
                            })}
                            className="px-8"
                        >
                            {t("pages.leads.notes.btn_cancel")}
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isLoading({
                                status: updateNoteMutation.status,
                            })}
                            icon={<SaveOutlined />}
                            className="bg-blue-600 hover:bg-blue-700 px-8"
                        >
                            {t("pages.leads.notes.btn_update")}
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};
