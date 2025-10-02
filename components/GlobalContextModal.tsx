
import React, { useState, useEffect } from 'react';
import { GlobeAltIcon, CloseIcon } from './Icons';

interface GlobalContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: string;
  onUpdateContext: (newContext: string) => void;
}

export const GlobalContextModal: React.FC<GlobalContextModalProps> = ({ isOpen, onClose, context, onUpdateContext }) => {
  const [localContext, setLocalContext] = useState(context);

  useEffect(() => {
    if (isOpen) {
      setLocalContext(context);
    }
  }, [isOpen, context]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateContext(localContext);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <GlobeAltIcon className="w-6 h-6 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">Global Application Context</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto flex-grow flex flex-col">
          <p className="text-sm text-gray-400 mb-4">
            Provide a general description of your application, its target audience, and the desired tone of voice. This context will be used by the AI during bulk translation to ensure consistency.
          </p>
          <textarea
            value={localContext}
            onChange={(e) => setLocalContext(e.target.value)}
            placeholder="e.g., This is a professional project management tool for software development teams. The tone should be formal, clear, and encouraging..."
            className="w-full flex-grow bg-gray-900 border border-gray-600 rounded-md p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition resize-none"
          />
        </div>

        <footer className="p-4 border-t border-gray-700 bg-gray-800/50 flex-shrink-0 flex justify-end space-x-2">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-md">
            Cancel
          </button>
          <button onClick={handleSave} className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md">
            Save Context
          </button>
        </footer>
      </div>
    </div>
  );
};