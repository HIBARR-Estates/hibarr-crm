import React, { useState } from "react";
import { Card, Button, Space, Typography, Divider } from "antd";
import {
    ContentRenderer,
    detectContentType,
} from "@/Components/ContentRenderer";

const { Title, Text } = Typography;

const ContentRendererDemo = () => {
    const [showFull, setShowFull] = useState(false);

    const sampleContents = [
        {
            type: "HTML",
            content: `<h2>Rich HTML Content</h2>
<p>This is a <strong>bold</strong> paragraph with <em>italic</em> text and a <a href="https://example.com">link</a>.</p>
<ul>
  <li>HTML list item 1</li>
  <li>HTML list item 2 with <code>inline code</code></li>
</ul>
<blockquote>This is a blockquote in HTML format</blockquote>
<p>And here's some more content to test truncation...</p>`,
            description: "HTML content with tags, links, and formatting",
        },
        {
            type: "Markdown",
            content: `# Markdown Heading

This is **bold** text and this is *italic* text.

## Features

- Markdown list item 1
- Markdown list item 2 with \`inline code\`
- List item 3

> This is a markdown blockquote

### Code Example

\`\`\`javascript
const hello = 'world';
console.log(hello);
\`\`\`

And here's a [link](https://example.com) and more content to test truncation...`,
            description:
                "Markdown content with headers, lists, and code blocks",
        },
        {
            type: "Plain Text",
            content: `This is plain text content without any special formatting. It should be rendered as-is with proper line breaks and spacing. This is a longer piece of content to demonstrate truncation functionality. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
            description: "Simple plain text without markup",
        },
    ];

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="text-center mb-8">
                <Title level={2}>ContentRenderer Demo</Title>
                <Text type="secondary">
                    Demonstrates automatic detection and rendering of HTML,
                    Markdown, and plain text
                </Text>
            </div>

            <div className="flex justify-center mb-6">
                <Button
                    type={showFull ? "default" : "primary"}
                    onClick={() => setShowFull(!showFull)}
                >
                    {showFull ? "Show Truncated" : "Show Full Content"}
                </Button>
            </div>

            <div className="grid gap-6">
                {sampleContents.map((sample, index) => {
                    const detectedType = detectContentType(sample.content);

                    return (
                        <Card
                            key={index}
                            title={
                                <div className="flex justify-between items-center">
                                    <span>{sample.type} Content</span>
                                    <Space>
                                        <Text
                                            type="secondary"
                                            className="text-sm"
                                        >
                                            Detected as:{" "}
                                            <strong>{detectedType}</strong>
                                        </Text>
                                    </Space>
                                </div>
                            }
                            className="shadow-sm"
                        >
                            <div className="space-y-4">
                                <Text type="secondary" className="block">
                                    {sample.description}
                                </Text>

                                <Divider className="my-3" />

                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <Title level={5} className="mb-3">
                                        Rendered Output:
                                    </Title>
                                    <ContentRenderer
                                        content={sample.content}
                                        maxLength={showFull ? undefined : 150}
                                        showFullContent={showFull}
                                        className="bg-white p-3 rounded border"
                                    />
                                </div>

                                {!showFull && (
                                    <div className="mt-3">
                                        <Text
                                            type="secondary"
                                            className="text-sm"
                                        >
                                            ↑ Content is truncated at 150
                                            characters. Click "Show Full
                                            Content" to see complete version.
                                        </Text>
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Card title="Interactive Example" className="shadow-sm">
                <div className="space-y-4">
                    <Text>
                        Click on the content below to see interactive behavior:
                    </Text>
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <ContentRenderer
                            content="# Click Me!\n\nThis content has an **onClick** handler. Try clicking anywhere on this content."
                            onClick={() => alert("Content was clicked!")}
                            className="bg-white p-3 rounded border"
                        />
                    </div>
                </div>
            </Card>

            <Card title="Use Cases" className="shadow-sm">
                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <Title level={5}>HTML Content</Title>
                        <Text type="secondary" className="text-sm">
                            • Rich text from WYSIWYG editors
                            <br />
                            • Email templates
                            <br />
                            • User-generated content
                            <br />• Legacy content
                        </Text>
                    </div>
                    <div>
                        <Title level={5}>Markdown Content</Title>
                        <Text type="secondary" className="text-sm">
                            • Documentation
                            <br />
                            • Technical notes
                            <br />
                            • README files
                            <br />• Blog posts
                        </Text>
                    </div>
                    <div>
                        <Title level={5}>Plain Text</Title>
                        <Text type="secondary" className="text-sm">
                            • Simple notes
                            <br />
                            • Comments
                            <br />
                            • Descriptions
                            <br />• Fallback content
                        </Text>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ContentRendererDemo;
