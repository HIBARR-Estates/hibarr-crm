import React, { useState } from "react";
import { Form, Button, Input, Radio, Card, Space } from "antd";
import { FileTextOutlined, CodeOutlined } from "@ant-design/icons";
import HtmlEditor from "@/Components/HtmlEditor";
import MarkdownEditor from "@/Components/MarkdownEditor";

type EditorType = "html" | "markdown";

const EditorComparison = () => {
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
            <Card title="HTML vs Markdown Editor Comparison">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    className="space-y-4"
                >
                    {/* Editor Type Selection */}
                    <Form.Item label="Choose Editor Type">
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
                        label="Title"
                        name="title"
                        rules={[
                            { required: true, message: "Please enter a title" },
                        ]}
                    >
                        <Input placeholder="Enter title" />
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
                                placeholder="Enter HTML content..."
                                height={400}
                            />
                        ) : (
                            <MarkdownEditor
                                placeholder="Enter markdown content..."
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
                                Get Current Values
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>

                {/* Comparison Info */}
                <Card title="Editor Comparison" className="mt-6" size="small">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-blue-600">
                                HTML Editor
                            </h4>
                            <ul className="text-sm space-y-1">
                                <li>✅ WYSIWYG editing</li>
                                <li>✅ Rich formatting options</li>
                                <li>✅ Direct HTML output</li>
                                <li>✅ Color picker</li>
                                <li>✅ Image insertion</li>
                                <li>❌ Learning curve for HTML</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-green-600">
                                Markdown Editor
                            </h4>
                            <ul className="text-sm space-y-1">
                                <li>✅ Simple syntax</li>
                                <li>✅ Live preview</li>
                                <li>✅ Faster typing</li>
                                <li>✅ Version control friendly</li>
                                <li>✅ Code syntax highlighting</li>
                                <li>❌ Limited formatting options</li>
                            </ul>
                        </div>
                    </div>
                </Card>
            </Card>
        </div>
    );
};

export default EditorComparison;
