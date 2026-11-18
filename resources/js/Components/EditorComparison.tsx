import React, { useState } from "react";
import { Form, Button, Input, Radio, Card, Space } from "antd";
import { FileTextOutlined, CodeOutlined } from "@ant-design/icons";
import HtmlEditor from "@/Components/HtmlEditor";
import MarkdownEditor from "@/Components/MarkdownEditor";
import { useTd } from "@/Hooks/useDynamicTranslation";

type EditorType = "html" | "markdown";

const EditorComparison = () => {
    const { td } = useTd();
    const [form] = Form.useForm();
    const [editorType, setEditorType] = useState<EditorType>("html");

    const handleSubmit = (values: any) => {
        console.log("Form values:", values);
        console.log(`${editorType} content:`, values.content);
    };

    const handleEditorTypeChange = (type: EditorType) => {
        setEditorType(type);
        // Clear the content when switching editors
        form.setFieldsValue({ content: "" });
    };

    const sampleHtmlContent = `<h1>Sample HTML Content</h1>
<p>This is a <strong>bold</strong> text and this is <em>italic</em>.</p>
<ul>
  <li>HTML List Item 1</li>
  <li>HTML List Item 2</li>
</ul>
<blockquote>This is a blockquote in HTML</blockquote>`;

    const sampleMarkdownContent = `# Sample Markdown Content

This is a **bold** text and this is *italic*.

- Markdown List Item 1
- Markdown List Item 2

> This is a blockquote in Markdown

\`\`\`javascript
const code = 'example';
console.log(code);
\`\`\``;

    const loadSampleContent = () => {
        const content =
            editorType === "html" ? sampleHtmlContent : sampleMarkdownContent;
        form.setFieldsValue({ content });
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <Card title={td("HTML vs Markdown Editor Comparison", { source: "en" })}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    className="space-y-4"
                >
                    {/* Editor Type Selection */}
                    <Form.Item label={td("Choose Editor Type", { source: "en" })}>
                        <Radio.Group
                            value={editorType}
                            onChange={(e) =>
                                handleEditorTypeChange(e.target.value)
                            }
                            size="large"
                        >
                            <Radio.Button value="html">
                                <FileTextOutlined /> HTML Editor
                            </Radio.Button>
                            <Radio.Button value="markdown">
                                <CodeOutlined /> Markdown Editor
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {/* Title Field */}
                    <Form.Item
                        label={td("Title", { source: "en" })}
                        name="title"
                        rules={[
                            { required: true, message: "Please enter a title" },
                        ]}
                    >
                        <Input placeholder={td("Enter title", { source: "en" })} />
                    </Form.Item>

                    {/* Dynamic Editor */}
                    <Form.Item
                        label={`Content (${editorType.toUpperCase()})`}
                        name="content"
                        rules={[
                            {
                                required: true,
                                validator: (_, value) => {
                                    let textContent = "";

                                    if (editorType === "html") {
                                        // Strip HTML tags for validation
                                        textContent = (value || "")
                                            .replace(/<[^>]*>/g, "")
                                            .replace(/&nbsp;/g, " ")
                                            .trim();
                                    } else {
                                        // For markdown, just trim
                                        textContent = (value || "").trim();
                                    }

                                    if (!textContent) {
                                        return Promise.reject(
                                            new Error("Please enter content")
                                        );
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        {editorType === "html" ? (
                            <HtmlEditor
                                placeholder={td("Enter HTML content...", { source: "en" })}
                                height={400}
                            />
                        ) : (
                            <MarkdownEditor
                                placeholder={td("Enter markdown content...", { source: "en" })}
                                height={400}
                                preview="live"
                            />
                        )}
                    </Form.Item>

                    {/* Action Buttons */}
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                Submit {editorType.toUpperCase()}
                            </Button>
                            <Button onClick={loadSampleContent}>
                                Load Sample {editorType.toUpperCase()}
                            </Button>
                            <Button
                                onClick={() => {
                                    const values = form.getFieldsValue();
                                    console.log("Current values:", values);
                                }}
                            >
                                {td("Get Current Values", { source: "en" })}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>

                {/* Comparison Info */}
                <Card title={td("Editor Comparison", { source: "en" })} className="mt-6" size="small">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-blue-600">
                                {td("HTML Editor", { source: "en" })}
                            </h4>
                            <ul className="text-sm space-y-1">
                                <li>{td("✅ WYSIWYG editing", { source: "en" })}</li>
                                <li>{td("✅ Rich formatting options", { source: "en" })}</li>
                                <li>{td("✅ Direct HTML output", { source: "en" })}</li>
                                <li>{td("✅ Color picker", { source: "en" })}</li>
                                <li>{td("✅ Image insertion", { source: "en" })}</li>
                                <li>{td("❌ Learning curve for HTML", { source: "en" })}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-green-600">
                                {td("Markdown Editor", { source: "en" })}
                            </h4>
                            <ul className="text-sm space-y-1">
                                <li>{td("✅ Simple syntax", { source: "en" })}</li>
                                <li>{td("✅ Live preview", { source: "en" })}</li>
                                <li>{td("✅ Faster typing", { source: "en" })}</li>
                                <li>{td("✅ Version control friendly", { source: "en" })}</li>
                                <li>{td("✅ Code syntax highlighting", { source: "en" })}</li>
                                <li>{td("❌ Limited formatting options", { source: "en" })}</li>
                            </ul>
                        </div>
                    </div>
                </Card>
            </Card>
        </div>
    );
};

export default EditorComparison;
