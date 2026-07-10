import React from "react";
import { Form, Input, Modal, App, Alert } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { errorFormatter } from "@/lib/api/utils/common";
import HtmlEditor from "@/Components/HtmlEditor";
import { Note } from "@/Types/api/note";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import "@/Components/Common/note-modal.css";

interface UpdateNoteFormData {
    title: string;
    details: string;
}

interface EditNoteFormProps {
    deal: Deal;
    note: Note;
    onCancel: () => void;
}

const FORM_ID = "edit-deal-note-modal-form";

export const EditNoteForm: React.FC<EditNoteFormProps> = ({
    deal,
    note,
    onCancel,
}) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [errors, setErrors] = React.useState<string[]>([]);
    const { td } = useTd();

    // Custom validator for HTML content
    const validateHtmlContent = (_: any, value: string) => {
        const textContent = (value || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        if (!textContent || textContent === "") {
            return Promise.reject(new Error("Please enter note details"));
        }
        return Promise.resolve();
    };

    // Update note mutation
    const updateNoteMutation = useApiMutate<
        UpdateNoteFormData,
        Note,
        ApiResponse<Note>
    >(route("deal-notes.update", note.id), "PUT", (response) => {
        if (response?.status === "success") {
            message.success("Note updated successfully!");
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
                    {td("Edit")}
                </h2>
                <p className="mt-1 text-sm text-gray-500 truncate">
                    {td(note.title)}
                </p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {errors.length > 0 && (
                    <Alert
                        type="error"
                        message={td("Please fix the following errors:")}
                        description={
                            <ul className="mt-2">
                                {errors.map((error, index) => (
                                    <li key={index} className="text-red-600">
                                        {td(error)}
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
                        label={td("Note Title")}
                        rules={[
                            {
                                required: true,
                                message: td("Please enter a note title"),
                            },
                        ]}
                        className="mb-6"
                    >
                        <Input
                            placeholder={td(
                                "Enter a descriptive title for your note...",
                            )}
                            disabled={loading}
                            className="text-lg py-3"
                            autoFocus
                        />
                    </Form.Item>

                    <Form.Item
                        name="details"
                        label={td("Note Content")}
                        rules={[
                            {
                                required: true,
                                validator: validateHtmlContent,
                            },
                        ]}
                    >
                        <HtmlEditor
                            placeholder={td("Edit your note content...")}
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
                    {td("Cancel")}
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
                    {td("Update Note")}
                </button>
            </div>
        </Modal>
    );
};
