
import React, { useState, useEffect } from 'react';
import { CloseIcon, ClipboardIcon, CheckIcon } from './Icons';

interface PromptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  title?: string;
  subtitle?: string;
}

export const PromptViewerModal: React.FC<PromptViewerModalProps> = ({ isOpen, onClose, prompt, title = "Generated AI Prompt", subtitle }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto flex-grow relative">
          <button
            onClick={handleCopy}
            className={`absolute top-8 right-8 text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                copied
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {copied ? ( <> <CheckIcon className="w-4 h-4" /> <span>Copied!</span> </> ) 
            : ( <> <ClipboardIcon className="w-4 h-4" /> <span>Copy</span> </> )}
          </button>
          <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm bg-gray-900/50 p-4 rounded-md border border-gray-700">
            {prompt}
          </pre>
        </div>
      </div>
    </div>
  );
};