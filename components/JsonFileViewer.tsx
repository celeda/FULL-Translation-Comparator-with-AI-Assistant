

import React, { useMemo, useEffect, useRef } from 'react';

interface JsonFileViewerProps {
  jsonData: Record<string, any>;
  selectedKey: string;
}

// Simple syntax highlighting for JSON
const syntaxHighlight = (json: string) => {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'text-blue-300'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-teal-300'; // key
            } else {
                cls = 'text-green-300'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-purple-400'; // boolean
        } else if (/null/.test(match)) {
            cls = 'text-purple-400'; // null
        }
        return `<span class="${cls}">${match}</span>`;
    });
}

export const JsonFileViewer: React.FC<JsonFileViewerProps> = ({ jsonData, selectedKey }) => {
  const highlightRef = useRef<HTMLDivElement>(null);

  const { lines, highlightIndex } = useMemo(() => {
    if (!jsonData) return { lines: [], highlightIndex: -1 };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const lines = jsonString.split('\n');
    
    const keyParts = selectedKey.split('.');
    const lastKey = keyParts[keyParts.length - 1];
    
    // Escape special regex characters in the key
    const escapedKey = lastKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // A regex to find the key definition, matching optional indentation and the quoted key.
    const regex = new RegExp(`^\\s*"${escapedKey}":`);
    
    const highlightIndex = lines.findIndex(line => regex.test(line));
    
    return { lines, highlightIndex };
  }, [jsonData, selectedKey]);

  useEffect(() => {
    // Scroll the highlighted line into view with a small delay to ensure the DOM is ready
    const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({
            block: 'center',
            behavior: 'smooth',
        });
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightIndex, selectedKey, jsonData]);

  return (
    <div className="bg-gray-900/70 rounded-lg overflow-auto h-full text-sm font-mono border border-gray-700">
      <pre className="p-4">
        <code>
          {lines.map((line, index) => (
            <div
              key={index}
              ref={index === highlightIndex ? highlightRef : null}
              className={`flex -mx-4 px-4 ${index === highlightIndex ? 'bg-teal-900/50' : ''}`}
            >
              <span className="w-10 text-right pr-4 text-gray-500 select-none">
                {index + 1}
              </span>
              <span
                className="flex-1 whitespace-pre-wrap break-all"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }}
              />
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};