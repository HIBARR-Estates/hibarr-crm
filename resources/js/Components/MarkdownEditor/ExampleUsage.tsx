// Example usage of MarkdownEditor with Ant Design Forms

import React from "react";
import { Form, Button, Input, Select } from "antd";
import MarkdownEditor from "@/Components/MarkdownEditor";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Option } = Select;

const ExampleMarkdownForm = () => {
    const { td } = useTd();
    const [form] = Form.useForm();

    const handleSubmit = (values: any) => {
        // Access the Markdown content directly from form values
        console.log("Form values:", values);
        console.log("Markdown details:", values.details);

        // Alternative way to get values
        const formValues = form.getFieldsValue();
        console.log("Get field values:", formValues.details);
    };

    const handleGetValues = () => {
        // Get specific field value
        const detailsValue = form.getFieldValue("details");
        console.log("Details value:", detailsValue);

        // Get all form values
        const allValues = form.getFieldsValue();
        console.log("All values:", allValues);
    };

    const handlePreviewChange = (value: string) => {
        form.setFieldsValue({ preview: value });
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
                title: td("Sample Title", { source: "en" }),
                details: `# Sample Markdown Content

This is a **bold** text and this is *italic*.

## Lists

- Item 1
- Item 2
- Item 3

### Code Example

\`\`\`javascript
const hello = 'world';
console.log(hello);
\`\`\`

> This is a blockquote example.`,
                preview: "live",
            }}
        >
            <Form.Item
                label={td("Title", { source: "en" })}
                name="title"
                rules={[{ required: true, message: "Please enter title" }]}
            >
                <Input placeholder={td("Enter title", { source: "en" })} />
            </Form.Item>

            <Form.Item label={td("Preview Mode", { source: "en" })} name="preview">
                <Select onChange={handlePreviewChange}>
                    <Option value="live">{td("Live Preview", { source: "en" })}</Option>
                    <Option value="edit">{td("Edit Only", { source: "en" })}</Option>
                    <Option value="preview">{td("Preview Only", { source: "en" })}</Option>
                </Select>
            </Form.Item>

            <Form.Item
                label={td("Details (Markdown)", { source: "en" })}
                name="details"
                rules={[
                    {
                        required: true,
                        validator: (_, value) => {
                            const trimmedValue = (value || "").trim();

                            if (!trimmedValue) {
                                return Promise.reject(
                                    new Error("Please enter details")
                                );
                            }
                            return Promise.resolve();
                        },
                    },
                ]}
            >
                <MarkdownEditor
                    placeholder={td("Enter markdown content...", { source: "en" })}
                    height={400}
                    preview={form.getFieldValue("preview") || "live"}
                />
            </Form.Item>

            <div className="flex gap-2">
                <Button type="primary" htmlType="submit">
                    {td("Submit", { source: "en" })}
                </Button>
                <Button onClick={handleGetValues}>{td("Get Values", { source: "en" })}</Button>
            </div>
        </Form>
    );
};

// Example of different configurations
const MinimalMarkdownEditor = () => {
    const { td } = useTd();
    const [form] = Form.useForm();

    return (
        <Form form={form} layout="vertical">
            <Form.Item label={td("Simple Markdown", { source: "en" })} name="content">
                <MarkdownEditor
                    height={200}
                    preview="edit"
                    hideToolbar={false}
                    placeholder={td("Write your markdown here...", { source: "en" })}
                />
            </Form.Item>
        </Form>
    );
};

// Example with disabled state
const DisabledMarkdownEditor = () => {
    const { td } = useTd();
    const [form] = Form.useForm();

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={{
                content:
                    "# Read-only content\n\nThis content cannot be edited.",
            }}
        >
            <Form.Item label={td("Read-only Markdown", { source: "en" })} name="content">
                <MarkdownEditor
                    height={200}
                    disabled={true}
                    preview="preview"
                />
            </Form.Item>
        </Form>
    );
};

export default ExampleMarkdownForm;
export { MinimalMarkdownEditor, DisabledMarkdownEditor };
