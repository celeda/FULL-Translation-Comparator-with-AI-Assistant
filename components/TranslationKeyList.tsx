import React, { useState, useMemo } from 'react';
import { SearchIcon, ClipboardIcon, CheckIcon } from './Icons';
import type { TranslationFile } from '../types';
import { getValueByPath } from '../services/translationService';

interface TranslationKeyListProps {
  keys: string[];
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
  translationFiles: TranslationFile[];
}

export const TranslationKeyList: React.FC<TranslationKeyListProps> = ({ keys, selectedKey, onSelectKey, translationFiles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredKeys = useMemo(() => {
    if (!searchTerm) return keys;
    
    const lowercasedQuery = searchTerm.toLowerCase();
    const polishFile = translationFiles.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish'));

    return keys.filter(key => {
      const keyMatch = key.toLowerCase().includes(lowercasedQuery);
      if (keyMatch) {
        return true;
      }

      if (polishFile) {
        const value = getValueByPath(polishFile.data, key);
        if (typeof value === 'string' && value.toLowerCase().includes(lowercasedQuery)) {
          return true;
        }
      }
      
      return false;
    });
  }, [keys, searchTerm, translationFiles]);
  
  const handleCopyKey = (key: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when copying
    navigator.clipboard.writeText(key).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  return (
    <div className="flex flex-col flex-grow min-h-0">
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search keys or Polish values..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-scroll min-h-0">
        {filteredKeys.length > 0 ? (
          <ul>
            {filteredKeys.map(key => (
              <li key={key}>
                <button
                  onClick={() => onSelectKey(key)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 group flex justify-between items-center ${
                    selectedKey === key
                      ? 'bg-teal-500/20 text-teal-300 font-semibold'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                    <span className="truncate pr-2">{key}</span>
                    <button
                        onClick={(e) => handleCopyKey(key, e)}
                        className="p-1 rounded-md text-gray-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0"
                        title="Copy key"
                    >
                        {copiedKey === key ? (
                            <CheckIcon className="w-4 h-4 text-green-400" />
                        ) : (
                            <ClipboardIcon className="w-4 h-4" />
                        )}
                    </button>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            No keys found.
          </div>
        )}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-center text-gray-500 flex-shrink-0">
        {filteredKeys.length} / {keys.length} keys shown
      </div>
    </div>
  );
};