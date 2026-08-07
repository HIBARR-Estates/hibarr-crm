import React from 'react';
import DOMPurify from 'dompurify';
import './ContentRenderer.css';

interface HtmlRendererProps {
  content: string;
  className?: string;
  maxLength?: number;
  showFullContent?: boolean;
}

const HtmlRenderer: React.FC<HtmlRendererProps> = ({
  content,
  className = '',
  maxLength,
  showFullContent = false,
}) => {
  // Sanitize HTML content to prevent XSS
  const sanitizedHtml = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'div', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ],
    ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'title', 'class', 'style'],
    ALLOW_DATA_ATTR: false,
  });

  // Truncate HTML content if maxLength is specified and not showing full content
  let displayContent = sanitizedHtml;
  
  if (maxLength && !showFullContent) {
    // Create a temporary element to extract text content for length calculation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizedHtml;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    if (textContent.length > maxLength) {
      // If content is too long, truncate and add ellipsis
      const truncatedText = textContent.substring(0, maxLength);
      // Find the last complete word
      const lastSpaceIndex = truncatedText.lastIndexOf(' ');
      const finalText = lastSpaceIndex > 0 ? truncatedText.substring(0, lastSpaceIndex) : truncatedText;
      
      // Create simple HTML with the truncated text
      displayContent = `<p>${finalText}...</p>`;
    }
  }

  return (
    <div 
      className={`html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: displayContent }}
      style={{
        lineHeight: '1.5',
        wordBreak: 'break-word',
      }}
    />
  );
};

export default HtmlRenderer;