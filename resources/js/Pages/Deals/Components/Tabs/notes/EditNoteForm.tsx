import React from "react";
import { Card, Form, Input, Button, App, Alert } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { errorFormatter } from "@/lib/api/utils/common";
import HtmlEditor from "@/Components/HtmlEditor";
import { Note } from "@/Types/api/note";
import { Deal } from "@/Types/api/deals";

interface UpdateNoteFormData {
    title: string;
    details: string;
}

interface EditNoteFormProps {
    deal: Deal;
    note: Note;
    onCancel: () => void;
}

export const EditNoteForm: React.FC<EditNoteFormProps> = ({
    deal,
    note,
    onCancel,
}) => {
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

    return (
        <div className="">
            <Card
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
                        Back to Notes
                    </Button>
                </div>

                {errors.length > 0 && (
                    <Alert
                        type="error"
                        message="Please fix the following errors:"
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
                        label="Note Title"
                        rules={[
                            {
                                required: true,
                                message: "Please enter a note title",
                            },
                        ]}
                        className="mb-6"
                    >
                        <Input
                            placeholder="Enter a descriptive title for your note..."
                            disabled={isLoading({
                                status: updateNoteMutation.status,
                            })}
                            className="text-lg py-3"
                            autoFocus
                        />
                    </Form.Item>

                    <Form.Item
                        name="details"
                        label="Note Content"
                        rules={[
                            {
                                required: true,
                                validator: validateHtmlContent,
                            },
                        ]}
                        className="mb-6"
                    >
                        <HtmlEditor
                            placeholder="Edit your note content..."
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
                            Cancel
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
                            Update Note
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};
