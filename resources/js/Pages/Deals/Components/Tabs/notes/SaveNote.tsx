import { Deal } from "@/Types/api/deals";
import { Note } from "@/Types/api/note";
import { Form, Input, Button } from "antd";
import { useEffect } from "react";
import { SaveOutlined } from "@ant-design/icons";
import HtmlEditor from "@/Components/HtmlEditor";

const { TextArea } = Input;

interface SaveNoteFormData {
    title: string;
    details: string;
    lead_id: number;
}

interface Props {
    deal: Deal;
    note?: Note;
    onSubmit: (data: SaveNoteFormData) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
}

export default function SaveNote({
    deal,
    note,
    onSubmit,
    onCancel,
    loading = false,
    errors = [],
}: Props) {
    const [form] = Form.useForm();

    const isEditing = !!note;

    // Initialize form with note data if editing
    useEffect(() => {
        if (note) {
            form.setFieldsValue({
                title: note.title,
                details: note.details || "",
            });
        } else {
            form.resetFields();
        }
    }, [note, form]);

    const handleSubmit = (values: any) => {
        const submitData: SaveNoteFormData = {
            title: values.title,
            details: values.details,
            lead_id: deal.id,
        };
        onSubmit(submitData);
    };

    // Custom validator for HTML content
    const validateHtmlContent = (_: any, value: string) => {
        // Strip HTML tags and check for actual text content
        const textContent = (value || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        if (!textContent || textContent === "") {
            return Promise.reject(new Error("Please enter note details"));
        }
        return Promise.resolve();
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="space-y-4"
        >
            {/* Display errors if any */}
            {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                    {errors.map((error, index) => (
                        <p key={index} className="text-red-600 text-sm mb-0">
                            {error}
                        </p>
                    ))}
                </div>
            )}

            <Form.Item
                label="Note Title"
                name="title"
                rules={[
                    {
                        required: true,
                        message: "Please enter a note title",
                    },
                ]}
                className="mb-4"
            >
                <Input
                    className="w-full"
                    placeholder="Enter note title"
                    disabled={loading}
                />
            </Form.Item>

            <Form.Item
                label="Note Details"
                name="details"
                className="mb-6"
                rules={[
                    {
                        required: true,
                        validator: validateHtmlContent,
                    },
                ]}
            >
                <HtmlEditor
                    placeholder="Enter detailed note information..."
                    disabled={loading}
                    height={300}
                />
            </Form.Item>

            <div className="flex items-center justify-end space-x-3 mt-12 mb-4 pt-4 border-t border-gray-200">
                <Button onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                >
                    {isEditing ? "Update Note" : "Save Note"}
                </Button>
            </div>
        </Form>
    );
}
