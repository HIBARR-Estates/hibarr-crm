# ContentRenderer System

A comprehensive content rendering system that automatically detects and renders HTML, Markdown, or plain text content with built-in truncation and sanitization features.

## Overview

The ContentRenderer system consists of three main components:

1. **ContentRenderer** - Main component that detects content type and renders accordingly
2. **HtmlRenderer** - Specialized component for rendering HTML content with sanitization
3. **MarkdownRenderer** - Specialized component for rendering Markdown content to HTML

## Features

### ✅ Automatic Content Detection

-   **HTML Detection**: Identifies HTML tags using regex patterns
-   **Markdown Detection**: Recognizes common markdown syntax patterns
-   **Plain Text Fallback**: Handles any content that doesn't match HTML or Markdown patterns

### ✅ Content Sanitization

-   **HTML Sanitization**: Uses DOMPurify to prevent XSS attacks
-   **Allowed Tags**: Configurable whitelist of safe HTML tags
-   **Attribute Filtering**: Only allows safe attributes like href, src, alt

### ✅ Smart Truncation

-   **Character-based**: Truncate content based on character count
-   **Word-aware**: Breaks at word boundaries to prevent cut-off words
-   **Type-specific**: Different truncation strategies for HTML, Markdown, and text

### ✅ Interactive Features

-   **Click Handlers**: Support for onClick events with hover effects
-   **Full Content Toggle**: Switch between truncated and full content views
-   **Responsive Design**: Works well on all screen sizes

## Usage Examples

### Basic Usage

```tsx
import { ContentRenderer } from "@/Components/ContentRenderer";

// Auto-detect and render any content type
<ContentRenderer
    content="# This is markdown\n\nWith **bold** text"
    maxLength={100}
    onClick={() => console.log("Clicked!")}
/>;
```

### Advanced Configuration

```tsx
// HTML content with truncation
<ContentRenderer
  content="<h1>HTML Title</h1><p>Some <strong>rich</strong> content</p>"
  maxLength={50}
  showFullContent={false}
  className="custom-styling"
  onClick={handleContentClick}
/>

// Markdown content with full display
<ContentRenderer
  content="# Heading\n\n- List item 1\n- List item 2"
  showFullContent={true}
  className="markdown-content"
/>

// Plain text with truncation
<ContentRenderer
  content="This is a long plain text content that will be truncated"
  maxLength={30}
/>
```

### In Tables (like NotesTab)

```tsx
// Table column with clickable content
{
  title: "Details",
  dataIndex: "details",
  render: (_, record) => (
    <ContentRenderer
      content={record.details}
      maxLength={200}
      onClick={() => handleViewNote(record)}
      className="cursor-pointer hover:text-blue-600"
    />
  ),
}
```

## Content Type Detection

### HTML Detection

Content is identified as HTML if it contains:

-   Opening/closing HTML tags: `<div>`, `</p>`, `<br/>`, etc.
-   Self-closing tags: `<img />`, `<hr />`, etc.

### Markdown Detection

Content is identified as Markdown if it contains:

-   Headers: `# Heading`, `## Subheading`
-   Bold/Italic: `**bold**`, `*italic*`
-   Links: `[text](url)`
-   Lists: `- item` or `1. item`
-   Code: `` `inline` `` or `blocks`
-   Blockquotes: `> quote`
-   Tables: `| col1 | col2 |`

### Plain Text Fallback

Any content that doesn't match HTML or Markdown patterns is treated as plain text.

## Component Props

### ContentRenderer

| Prop              | Type                  | Default | Description                                |
| ----------------- | --------------------- | ------- | ------------------------------------------ |
| `content`         | `string`              | -       | Content to render (required)               |
| `className`       | `string`              | `''`    | Additional CSS classes                     |
| `maxLength`       | `number`              | -       | Maximum character length before truncation |
| `showFullContent` | `boolean`             | `false` | Whether to show full content or truncated  |
| `onClick`         | `() => void`          | -       | Click handler for interactive content      |
| `style`           | `React.CSSProperties` | `{}`    | Additional inline styles                   |

### HtmlRenderer

| Prop              | Type      | Default | Description                             |
| ----------------- | --------- | ------- | --------------------------------------- |
| `content`         | `string`  | -       | HTML content to render                  |
| `className`       | `string`  | `''`    | Additional CSS classes                  |
| `maxLength`       | `number`  | -       | Maximum character length for truncation |
| `showFullContent` | `boolean` | `false` | Whether to show full content            |

### MarkdownRenderer

| Prop              | Type      | Default | Description                             |
| ----------------- | --------- | ------- | --------------------------------------- |
| `content`         | `string`  | -       | Markdown content to render              |
| `className`       | `string`  | `''`    | Additional CSS classes                  |
| `maxLength`       | `number`  | -       | Maximum character length for truncation |
| `showFullContent` | `boolean` | `false` | Whether to show full content            |

## Security Features

### HTML Sanitization

-   **XSS Prevention**: All HTML is sanitized using DOMPurify
-   **Tag Whitelist**: Only safe HTML tags are allowed
-   **Attribute Filtering**: Dangerous attributes are stripped
-   **Script Blocking**: No script tags or event handlers allowed

### Safe Attributes

Allowed attributes include:

-   `href`, `target` (for links)
-   `src`, `alt`, `title` (for images)
-   `class` (for styling)
-   Basic formatting attributes

## Styling

### Default Styles

-   **Line Height**: 1.5-1.6 for good readability
-   **Word Breaking**: Prevents overflow with long words
-   **Hover Effects**: Subtle opacity/color changes for clickable content

### Custom Styling

```tsx
// Add custom classes
<ContentRenderer
  content="content"
  className="prose prose-sm max-w-none text-gray-800"
/>

// Custom inline styles
<ContentRenderer
  content="content"
  style={{
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#374151'
  }}
/>
```

## Integration Examples

### NotesTab Integration

The ContentRenderer is used in the NotesTab component to:

-   Display note details with automatic content type detection
-   Truncate long content to prevent UI bloat
-   Provide click handlers to view full content
-   Handle title truncation for better table layout

### ViewNote Integration

The ViewNote component uses ContentRenderer to:

-   Display full note content without truncation
-   Properly render HTML, Markdown, or plain text
-   Maintain consistent styling across content types

## Performance Considerations

### Lazy Loading

-   Content detection runs only when content changes
-   HTML sanitization is cached when possible
-   Markdown parsing is optimized for performance

### Memory Management

-   Components are lightweight and efficient
-   No heavy dependencies beyond marked and DOMPurify
-   Proper cleanup of event handlers

## Best Practices

### Content Storage

1. **Consistent Format**: Store content in the format it was created (HTML/Markdown/Text)
2. **Validation**: Validate content on the server side as well
3. **Length Limits**: Set reasonable limits for content length

### UI/UX

1. **Progressive Disclosure**: Use truncation for list views, full content for detail views
2. **Visual Cues**: Make clickable content obvious with hover effects
3. **Loading States**: Show loading indicators for dynamic content

### Security

1. **Server Validation**: Always validate and sanitize on the server
2. **Content Policy**: Establish clear policies for allowed content
3. **Regular Updates**: Keep DOMPurify and other security dependencies updated

## Troubleshooting

### Common Issues

1. **Content Not Rendering**: Check if content string is valid
2. **Styling Issues**: Verify CSS classes are properly applied
3. **Security Warnings**: Ensure DOMPurify is properly configured

### Debug Mode

```tsx
// Enable debug mode to see detected content type
const contentType = detectContentType(content);
console.log("Detected content type:", contentType);
```

## Migration Guide

### From Raw HTML

```tsx
// Before
<div dangerouslySetInnerHTML={{ __html: content }} />

// After
<ContentRenderer content={content} />
```

### From Typography.Paragraph

```tsx
// Before
<Paragraph ellipsis={{ rows: 3 }}>{content}</Paragraph>

// After
<ContentRenderer content={content} maxLength={200} />
```

## Dependencies

-   `marked`: Markdown to HTML conversion
-   `dompurify`: HTML sanitization
-   `@types/marked`: TypeScript definitions
-   `@types/dompurify`: TypeScript definitions
