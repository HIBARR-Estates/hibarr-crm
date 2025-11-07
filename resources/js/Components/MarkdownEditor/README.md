# MarkdownEditor Component

A reusable Markdown editor component built with `@uiw/react-md-editor` for React applications using Ant Design.

## Features

-   Live markdown editing with real-time preview
-   Fully integrated with Ant Design Forms
-   Multiple preview modes (live, edit-only, preview-only)
-   Customizable toolbar with markdown formatting options
-   Support for syntax highlighting, tables, lists, and more
-   Responsive design with proper styling
-   Validation support
-   Disabled/readonly states
-   Dark/light theme support

## Installation

The component requires `@uiw/react-md-editor` as a dependency:

```bash
npm install @uiw/react-md-editor
```

## Basic Usage

```tsx
import React from "react";
import { Form, Button } from "antd";
import MarkdownEditor from "@/Components/MarkdownEditor";

const MyForm = () => {
    const [form] = Form.useForm();

    const handleSubmit = (values: any) => {
        console.log("Markdown content:", values.content);
    };

    return (
        <Form form={form} onFinish={handleSubmit}>
            <Form.Item
                name="content"
                label="Content"
                rules={[{ required: true, message: "Please enter content" }]}
            >
                <MarkdownEditor placeholder="Start typing markdown..." />
            </Form.Item>
            <Button type="primary" htmlType="submit">
                Submit
            </Button>
        </Form>
    );
};
```

## Props

| Prop             | Type                            | Default                      | Description                              |
| ---------------- | ------------------------------- | ---------------------------- | ---------------------------------------- |
| `value`          | `string`                        | `''`                         | Markdown content value                   |
| `onChange`       | `(value?: string) => void`      | -                            | Callback when content changes            |
| `placeholder`    | `string`                        | `'Start typing markdown...'` | Placeholder text                         |
| `preview`        | `'live' \| 'edit' \| 'preview'` | `'live'`                     | Preview mode                             |
| `hideToolbar`    | `boolean`                       | `false`                      | Hide the formatting toolbar              |
| `visibleDragbar` | `boolean`                       | `true`                       | Show drag bar between editor and preview |
| `height`         | `number`                        | `300`                        | Editor height in pixels                  |
| `disabled`       | `boolean`                       | `false`                      | Disable the editor                       |
| `readOnly`       | `boolean`                       | `false`                      | Make editor read-only                    |
| `className`      | `string`                        | `''`                         | Additional CSS classes                   |

## Preview Modes

### Live Preview (`preview="live"`)

Split view with editor on the left and live preview on the right.

```tsx
<MarkdownEditor preview="live" />
```

### Edit Only (`preview="edit"`)

Shows only the markdown editor without preview.

```tsx
<MarkdownEditor preview="edit" />
```

### Preview Only (`preview="preview"`)

Shows only the rendered markdown (good for read-only display).

```tsx
<MarkdownEditor preview="preview" readOnly />
```

## Form Integration

The component works seamlessly with Ant Design Forms:

```tsx
// Access values directly from form submission
const handleSubmit = (values: any) => {
    console.log("Details:", values.details); // Markdown string
};

// Get values programmatically
const detailsValue = form.getFieldValue("details");
const allValues = form.getFieldsValue();
```

## Validation

Use custom validators to check markdown content:

```tsx
<Form.Item
    name="details"
    rules={[
        {
            required: true,
            validator: (_, value) => {
                const trimmedValue = (value || "").trim();

                if (!trimmedValue) {
                    return Promise.reject(new Error("Please enter content"));
                }

                // Check minimum length
                if (trimmedValue.length < 10) {
                    return Promise.reject(
                        new Error("Content must be at least 10 characters")
                    );
                }

                return Promise.resolve();
            },
        },
    ]}
>
    <MarkdownEditor />
</Form.Item>
```

## Advanced Configuration

### Custom Height and Toolbar

```tsx
<MarkdownEditor
    height={500}
    hideToolbar={false}
    visibleDragbar={true}
    placeholder="Write detailed documentation..."
/>
```

### Disabled State

```tsx
<MarkdownEditor
    disabled={true}
    value="# Read-only content\n\nThis cannot be edited."
/>
```

### Dynamic Preview Mode

```tsx
const [previewMode, setPreviewMode] = useState('live');

<Select value={previewMode} onChange={setPreviewMode}>
  <Option value="live">Live Preview</Option>
  <Option value="edit">Edit Only</Option>
  <Option value="preview">Preview Only</Option>
</Select>

<MarkdownEditor preview={previewMode} />
```

## Markdown Features

The editor supports all standard markdown features:

-   **Headers**: `# H1`, `## H2`, `### H3`
-   **Emphasis**: `**bold**`, `*italic*`, `~~strikethrough~~`
-   **Lists**: `- bullet` or `1. numbered`
-   **Links**: `[text](url)`
-   **Images**: `![alt](url)`
-   **Code**: `` `inline` `` or `code blocks`
-   **Tables**: `| Col 1 | Col 2 |`
-   **Blockquotes**: `> quoted text`
-   **Horizontal rules**: `---`

## Styling

The component includes custom CSS for proper integration with Ant Design themes. The styles are automatically imported when using the component.

## Accessibility

-   Keyboard navigation support
-   Screen reader compatible
-   Proper ARIA labels and roles
-   Focus management

## Examples

See `ExampleUsage.tsx` for complete implementation examples including:

-   Basic form integration
-   Dynamic preview modes
-   Validation patterns
-   Disabled/readonly states
-   Custom configurations

## Output

The editor outputs clean markdown text that can be:

-   Stored in databases
-   Converted to HTML using markdown parsers
-   Displayed in other markdown renderers
-   Processed for documentation generation
