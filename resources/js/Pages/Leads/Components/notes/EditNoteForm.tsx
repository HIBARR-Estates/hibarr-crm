import React from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Form, Input, Modal, App, Alert } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { errorFormatter } from "@/lib/api/utils/common";
import HtmlEditor from "@/Components/HtmlEditor";
import { LeadNote } from "@/Types/api/lead-note";
import { Lead } from "@/Types/api/leads";
import "@/Components/Common/note-modal.css";

interface UpdateNoteFormData {
    title: string;
    details: string;
}

interface EditNoteFormProps {
    lead: Lead;
    note: LeadNote;
    onCancel: () => void;
}

const FORM_ID = "edit-note-modal-form";

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
            router.reload({ onSuccess: () => onCancel() });
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

    const loading = isLoading({ status: updateNoteMutation.status });

    return (
        <Modal
            className="note-modal"
            title={null}
            open
            onCancel={handleCancel}
            footer={null}
            width={700}
            centered
            destroyOnHidden
            maskClosable={!loading}
            closable={!loading}
        >
            {/* Header */}
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                    {t("pages.leads.notes.breadcrumb_edit")}
                </h2>
                <p className="mt-1 text-sm text-gray-500 truncate">
                    {note.title}
                </p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
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
                    id={FORM_ID}
                    form={form}
                    layout="vertical"
                    onFinish={handleUpdateNote}
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
                            disabled={loading}
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
                    >
                        <HtmlEditor
                            placeholder={t("pages.leads.notes.placeholder_content_edit")}
                            disabled={loading}
                            height={300}
                        />
                    </Form.Item>
                </Form>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
                <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                    {t("pages.leads.notes.btn_cancel")}
                </button>
                <button
                    form={FORM_ID}
                    type="submit"
                    disabled={loading}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        !loading
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 active:scale-[0.98]"
                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                >
                    <SaveOutlined />
                    {t("pages.leads.notes.btn_update")}
                </button>
            </div>
        </Modal>
    );
};
