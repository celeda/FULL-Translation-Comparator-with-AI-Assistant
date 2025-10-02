
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) {
    return null;
  }

  // Parses a single line for bold/italic and returns an array of React nodes
  const renderLine = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const blocks = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentListItems: string[] = [];

  const flushListItems = () => {
    if (currentListItems.length > 0) {
      renderedElements.push(
        <ul key={`ul-${renderedElements.length}`} className="list-disc pl-5 space-y-1">
          {currentListItems.map((item, i) => (
            <li key={i}>{renderLine(item)}</li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };

  blocks.forEach((block) => {
    const trimmedBlock = block.trim();
    if (trimmedBlock.startsWith('- ')) {
      currentListItems.push(trimmedBlock.substring(2).trim());
    } else {
      flushListItems();
      if (trimmedBlock) {
        renderedElements.push(
          <p key={`p-${renderedElements.length}`}>{renderLine(trimmedBlock)}</p>
        );
      }
    }
  });

  flushListItems();

  return <div className="space-y-2 text-gray-300">{renderedElements}</div>;
};