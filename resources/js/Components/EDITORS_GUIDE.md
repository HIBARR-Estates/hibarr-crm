# Rich Text Editors - HTML & Markdown

This document provides an overview of the two rich text editor components available in the application: **HtmlEditor** and **MarkdownEditor**.

## Overview

Both editors are designed for seamless integration with Ant Design Forms and provide excellent user experience for content creation.

### HtmlEditor (react-quill-new)
- **Use case**: When you need rich formatting with visual editing
- **Output**: Clean HTML markup
- **Best for**: Email templates, rich content, formatted documents

### MarkdownEditor (@uiw/react-md-editor)
- **Use case**: When you need structured content with simple syntax
- **Output**: Markdown text
- **Best for**: Documentation, notes, technical content

## Quick Start

### Installing Dependencies

```bash
# For HTML Editor
npm install react-quill-new

# For Markdown Editor
npm install @uiw/react-md-editor
```

### Basic Usage

```tsx
import HtmlEditor from '@/Components/HtmlEditor';
import MarkdownEditor from '@/Components/MarkdownEditor';

// HTML Editor
<Form.Item name="htmlContent">
  <HtmlEditor placeholder="Enter HTML content..." />
</Form.Item>

// Markdown Editor
<Form.Item name="markdownContent">
  <MarkdownEditor placeholder="Enter markdown content..." />
</Form.Item>
```

## Comparison Table

| Feature | HtmlEditor | MarkdownEditor |
|---------|------------|----------------|
| **Learning Curve** | Low (WYSIWYG) | Medium (Markdown syntax) |
| **Output Format** | HTML | Markdown |
| **File Size** | Larger | Smaller |
| **Version Control** | Harder to diff | Easy to diff |
| **Formatting Options** | Extensive | Standard markdown |
| **Live Preview** | Built-in | Split/live view |
| **Mobile Friendly** | Good | Excellent |
| **Accessibility** | Good | Excellent |
| **Code Highlighting** | Basic | Advanced |
| **Table Support** | Advanced | Basic |
| **Image Insertion** | Drag & drop | URL/upload |
| **Custom Styling** | Full control | Limited |

## When to Use Which?

### Choose HtmlEditor when:
- Creating email templates or newsletters
- Need rich formatting (colors, fonts, complex layouts)
- Users are not technical
- Need drag-and-drop image insertion
- Creating marketing content or rich documents

### Choose MarkdownEditor when:
- Writing documentation or technical content
- Need version control friendliness
- Users are familiar with markdown
- Want faster typing and editing
- Creating structured content (headers, lists, code blocks)
- Need clean, consistent formatting

## Form Integration Examples

### Accessing Values

Both editors integrate seamlessly with Ant Design forms:

```tsx
const handleSubmit = (values: any) => {
  console.log('HTML content:', values.htmlField);
  console.log('Markdown content:', values.markdownField);
};

// Get values programmatically
const htmlContent = form.getFieldValue('htmlField');
const markdownContent = form.getFieldValue('markdownField');
```

### Validation

```tsx
// HTML Editor validation
<Form.Item
  name="htmlContent"
  rules={[
    {
      required: true,
      validator: (_, value) => {
        const textContent = (value || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();
        
        if (!textContent) {
          return Promise.reject(new Error('Please enter content'));
        }
        return Promise.resolve();
      },
    },
  ]}
>
  <HtmlEditor />
</Form.Item>

// Markdown Editor validation
<Form.Item
  name="markdownContent"
  rules={[
    {
      required: true,
      validator: (_, value) => {
        const trimmedValue = (value || '').trim();
        if (!trimmedValue) {
          return Promise.reject(new Error('Please enter content'));
        }
        return Promise.resolve();
      },
    },
  ]}
>
  <MarkdownEditor />
</Form.Item>
```

## Configuration Examples

### HTML Editor Configurations

```tsx
// Basic configuration
<HtmlEditor
  placeholder="Enter content..."
  height={300}
/>

// Advanced configuration
<HtmlEditor
  placeholder="Enter detailed content..."
  height={500}
  disabled={loading}
  className="custom-html-editor"
/>
```

### Markdown Editor Configurations

```tsx
// Live preview (default)
<MarkdownEditor
  placeholder="Enter markdown..."
  preview="live"
  height={400}
/>

// Edit only mode
<MarkdownEditor
  preview="edit"
  hideToolbar={false}
  height={300}
/>

// Preview only (read-only)
<MarkdownEditor
  preview="preview"
  readOnly={true}
  value={existingMarkdown}
/>
```

## Output Processing

### HTML Editor Output
The HTML editor outputs clean HTML that can be:
- Displayed directly in web pages using `dangerouslySetInnerHTML`
- Stored in databases as HTML
- Used in email templates
- Converted to other formats using HTML parsers

### Markdown Editor Output
The Markdown editor outputs standard markdown that can be:
- Converted to HTML using markdown parsers (like `marked` or `markdown-it`)
- Displayed in markdown viewers
- Stored in version control systems
- Used for documentation generation

## Best Practices

### General
1. **Consistent Choice**: Use the same editor type throughout related features
2. **Validation**: Always validate content on both client and server side
3. **Sanitization**: Sanitize HTML output to prevent XSS attacks
4. **Mobile Testing**: Test editors on mobile devices for usability

### HTML Editor
1. **Content Security**: Sanitize HTML output using libraries like DOMPurify
2. **Image Handling**: Implement proper image upload and storage
3. **Styling**: Ensure generated HTML works with your application's CSS

### Markdown Editor
1. **Parser Choice**: Use a consistent markdown parser across your application
2. **Syntax Guide**: Provide users with a markdown syntax reference
3. **Preview**: Always show preview for better user experience

## Troubleshooting

### Common Issues

1. **Styles not loading**: Make sure CSS imports are included
2. **Form validation**: Use proper validators for each editor type
3. **Mobile responsiveness**: Test on various screen sizes
4. **Performance**: Consider lazy loading for pages with multiple editors

### React 19 Compatibility
Both editors are tested and compatible with React 19, avoiding the `findDOMNode` deprecation issues found in older editor libraries.

## Examples

See the following files for complete examples:
- `HtmlEditor/ExampleUsage.tsx` - HTML editor examples
- `MarkdownEditor/ExampleUsage.tsx` - Markdown editor examples
- `EditorComparison.tsx` - Side-by-side comparison

## Migration Guide

If migrating from other editors:
1. **From react-quill**: Replace imports and update prop names
2. **From @uiw/react-md-editor**: Update to our wrapped component
3. **From custom editors**: Map existing functionality to new editor features