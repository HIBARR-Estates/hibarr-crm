# HtmlEditor Component

A reusable HTML WYSIWYG editor component built with react-quill-new for React applications using Ant Design.

## Features

-   Rich text editing with HTML output
-   Fully integrated with Ant Design Forms
-   Customizable toolbar with common formatting options
-   Support for headings, lists, links, images, and text formatting
-   Responsive design with proper styling
-   Validation support
-   Disabled/readonly states

## Installation

The component requires `react-quill-new` as a dependency:

```bash
npm install react-quill-new
```

## Basic Usage

```tsx
import React from "react";
import { Form, Button } from "antd";
import HtmlEditor from "@/Components/HtmlEditor";

const MyForm = () => {
    const [form] = Form.useForm();

    const handleSubmit = (values: any) => {
        console.log("HTML content:", values.content);
    };

    return (
        <Form form={form} onFinish={handleSubmit}>
            <Form.Item
                name="content"
                label="Content"
                rules={[{ required: true, message: "Please enter content" }]}
            >
                <HtmlEditor placeholder="Start typing..." />
            </Form.Item>
            <Button type="primary" htmlType="submit">
                Submit
            </Button>
        </Form>
    );
};
```

## Props

| Prop          | Type                      | Default             | Description                   |
| ------------- | ------------------------- | ------------------- | ----------------------------- |
| `value`       | `string`                  | `''`                | HTML content value            |
| `onChange`    | `(value: string) => void` | -                   | Callback when content changes |
| `placeholder` | `string`                  | `'Start typing...'` | Placeholder text              |
| `readOnly`    | `boolean`                 | `false`             | Make editor read-only         |
| `disabled`    | `boolean`                 | `false`             | Disable the editor            |
| `height`      | `number`                  | `200`               | Editor height in pixels       |
| `className`   | `string`                  | `''`                | Additional CSS classes        |

## Form Integration

The component works seamlessly with Ant Design Forms:

```tsx
// Access values directly from form submission
const handleSubmit = (values: any) => {
    console.log("Details:", values.details); // HTML string
};

// Get values programmatically
const detailsValue = form.getFieldValue("details");
const allValues = form.getFieldsValue();
```

## Validation

Use custom validators to check HTML content:

```tsx
<Form.Item
    name="details"
    rules={[
        {
            required: true,
            validator: (_, value) => {
                // Strip HTML tags and check for actual text content
                const textContent = (value || "")
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, " ")
                    .trim();

                if (!textContent) {
                    return Promise.reject(new Error("Please enter content"));
                }
                return Promise.resolve();
            },
        },
    ]}
>
    <HtmlEditor />
</Form.Item>
```

## Styling

The component includes custom CSS for proper integration with Ant Design themes. The styles are automatically imported when using the component.

## Toolbar Features

-   **Text Formatting**: Bold, Italic, Underline, Strike-through
-   **Headers**: H1, H2, H3
-   **Lists**: Ordered and Unordered lists
-   **Alignment**: Text alignment options
-   **Colors**: Text and background colors
-   **Links and Images**: Insert links and images
-   **Code**: Inline code and code blocks
-   **Quotes**: Blockquotes
-   **Indent**: Increase/decrease indentation
-   **Clean**: Remove formatting

## Examples

See `ExampleUsage.tsx` for complete implementation examples including form validation and value access patterns.
