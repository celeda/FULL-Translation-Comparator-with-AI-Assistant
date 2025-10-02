
import React, { useState, useMemo } from 'react';
import type { BulkTranslationSuggestion, TranslationFile } from '../types';
import { CloseIcon, LanguageIcon, CheckIcon } from './Icons';
import { getValueByPath } from '../services/translationService';

interface BulkTranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: BulkTranslationSuggestion[];
  files: TranslationFile[];
  isLoading: boolean;
  progress: { current: number; total: number };
  onAcceptSuggestion: (lang: string, key: string, value: string) => void;
}

const SuggestionRow: React.FC<{
    suggestion: BulkTranslationSuggestion;
    lang: string;
    currentValue: any;
    onAccept: (lang: string, key: string, value: string) => void;
}> = ({ suggestion, lang, currentValue, onAccept }) => {
    const [accepted, setAccepted] = useState(false);
    const suggestedValue = suggestion.suggestions[lang];
    const isNew = currentValue === undefined || currentValue === null || currentValue === '';
    const isChanged = !isNew && currentValue !== suggestedValue;
    
    if (!suggestedValue) return null;

    const handleAccept = () => {
        onAccept(lang, suggestion.key, suggestedValue);
        setAccepted(true);
    };
    
    let statusBadge;
    if (isNew) {
        statusBadge = <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">New</span>;
    } else if (isChanged) {
        statusBadge = <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">Changed</span>
    } else {
         statusBadge = <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">No Change</span>
    }

    return (
         <tr className={`${accepted ? 'bg-green-900/20' : isChanged ? 'bg-yellow-900/10' : ''}`}>
            <td className="p-2 font-mono text-xs text-teal-400 break-all">{suggestion.key}</td>
            <td className="p-2 text-xs text-gray-400 break-all">{String(currentValue || '')}</td>
            <td className="p-2 text-xs text-green-300 break-all">{suggestedValue}</td>
            <td className="p-2 w-24 text-center">{statusBadge}</td>
            <td className="p-2 w-28 text-center">
                {(isNew || isChanged) && (
                    accepted ? (
                        <div className="flex items-center justify-center space-x-1 text-green-400 font-semibold">
                            <CheckIcon className="w-4 h-4"/>
                            <span>Accepted</span>
                        </div>
                    ) : (
                        <button onClick={handleAccept} className="text-xs bg-teal-600 hover:bg-teal-500 text-white font-semibold py-1 px-2 rounded-md">Accept</button>
                    )
                )}
            </td>
        </tr>
    );
}


export const BulkTranslateModal: React.FC<BulkTranslateModalProps> = ({ isOpen, onClose, suggestions, files, isLoading, progress, onAcceptSuggestion }) => {
  const [selectedLang, setSelectedLang] = useState('');

  const targetLangs = useMemo(() => {
      const langs = new Set<string>();
      suggestions.forEach(s => {
          Object.keys(s.suggestions).forEach(lang => langs.add(lang));
      });
      const sortedLangs = Array.from(langs).sort();
      if (!selectedLang && sortedLangs.length > 0) {
          setSelectedLang(sortedLangs[0]);
      }
      return sortedLangs;
  }, [suggestions, selectedLang]);
  
  const selectedLangFile = useMemo(() => files.find(f => f.name === selectedLang), [files, selectedLang]);

  const suggestionsForLang = useMemo(() => {
    return suggestions.filter(s => s.suggestions[selectedLang]);
  }, [suggestions, selectedLang]);

  if (!isOpen) return null;
  
  const handleAcceptAllForLang = () => {
      if (!selectedLangFile) return;
      suggestionsForLang.forEach(s => {
          const currentValue = getValueByPath(selectedLangFile.data, s.key);
          const suggestedValue = s.suggestions[selectedLang];
          if (currentValue !== suggestedValue) {
            onAcceptSuggestion(selectedLang, s.key, suggestedValue);
          }
      });
      // This won't visually update the rows to "Accepted" state, which is a minor UX issue,
      // but the data will be updated correctly. A more complex state management would be needed for that.
      alert(`Accepted all suggestions for ${selectedLang}.`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <LanguageIcon className="w-6 h-6 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">AI Bulk Translation Review</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto flex-grow flex flex-col">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-300">Translating all keys...</p>
              <p className="mt-2 text-gray-500">{progress.current} of {progress.total} keys processed.</p>
              <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
                  <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
              </div>
            </div>
          )}
          
          {!isLoading && suggestions.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full">
                <p className="text-lg text-gray-400">No translation suggestions were generated.</p>
                <p className="mt-2 text-sm text-gray-500">This could be due to an API error or no translatable keys found.</p>
            </div>
          )}

          {!isLoading && suggestions.length > 0 && (
            <div className="flex flex-col flex-grow min-h-0">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex space-x-1 p-1 bg-gray-900 rounded-lg">
                        {targetLangs.map(lang => (
                            <button 
                                key={lang}
                                onClick={() => setSelectedLang(lang)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${selectedLang === lang ? 'bg-teal-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                            >
                                {lang}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleAcceptAllForLang} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md">
                        Accept All for {selectedLang}
                    </button>
                </div>
                <div className="overflow-y-auto flex-grow border border-gray-700 rounded-lg">
                    <table className="w-full text-left table-fixed">
                        <thead className="sticky top-0 bg-gray-800/90 backdrop-blur-sm z-10">
                            <tr>
                                <th className="p-2 font-semibold text-sm text-gray-400">Key</th>
                                <th className="p-2 font-semibold text-sm text-gray-400">Current Value</th>
                                <th className="p-2 font-semibold text-sm text-gray-400">AI Suggestion</th>
                                <th className="p-2 font-semibold text-sm text-gray-400 w-24 text-center">Status</th>
                                <th className="p-2 font-semibold text-sm text-gray-400 w-28 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {suggestionsForLang.map(s => (
                                <SuggestionRow
                                    key={`${selectedLang}-${s.key}`}
                                    suggestion={s}
                                    lang={selectedLang}
                                    currentValue={selectedLangFile ? getValueByPath(selectedLangFile.data, s.key) : ''}
                                    onAccept={onAcceptSuggestion}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};