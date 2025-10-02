
import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory } from '../types';
import { getValueByPath } from '../services/translationService';
import { bulkTranslateKeys } from '../services/aiService';
import { LanguageIcon, SparklesIcon, CheckIcon, DownloadIcon } from './Icons';

interface BulkTranslateViewProps {
  allKeys: string[];
  files: TranslationFile[];
  contexts: Record<string, any>;
  translationHistory: TranslationHistory;
  onSave: (targetLang: string, updatedValues: Record<string, string>) => void;
}

export const BulkTranslateView: React.FC<BulkTranslateViewProps> = (props) => {
  const { allKeys, files, contexts, translationHistory, onSave } = props;

  const [targetLang, setTargetLang] = useState<string>('');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const polishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish')), [files]);
  const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);
  
  const targetLangs = useMemo(() => 
    files.filter(f => f.name !== polishFile?.name && f.name !== englishFile?.name).map(f => f.name).sort()
  , [files, polishFile, englishFile]);

  useEffect(() => {
    if (targetLangs.length > 0 && !targetLang) {
      setTargetLang(targetLangs[0]);
    }
  }, [targetLangs, targetLang]);
  
  useEffect(() => {
    // Reset state when target language changes
    setEditedValues({});
    setSuggestions({});
    setError(null);
    setIsLoading(false);
  }, [targetLang]);

  const tableData = useMemo(() => {
    if (!targetLang) return [];
    const targetFile = files.find(f => f.name === targetLang);

    return allKeys.map(key => ({
      key,
      pl: String(getValueByPath(polishFile?.data, key) ?? ''),
      en: String(getValueByPath(englishFile?.data, key) ?? ''),
      context: String(getValueByPath(contexts, key) ?? ''),
      currentValue: editedValues[key] ?? String(getValueByPath(targetFile?.data, key) ?? ''),
      suggestion: suggestions[key],
    }));
  }, [allKeys, targetLang, files, polishFile, englishFile, contexts, editedValues, suggestions]);
  
  const handleGenerateSuggestions = async () => {
    if (!targetLang || !polishFile) {
        setError("Cannot generate suggestions without a target language and a Polish source file.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setSuggestions({});
    setProgress({ current: 0, total: allKeys.length });

    const keysToTranslate = allKeys.map(key => {
        const targetFile = files.find(f => f.name === targetLang);
        return {
            key,
            pl: String(getValueByPath(polishFile.data, key) ?? ''),
            en: String(getValueByPath(englishFile?.data, key) ?? ''),
            context: String(getValueByPath(contexts, key) ?? ''),
            currentValue: String(getValueByPath(targetFile?.data, key) ?? ''),
        };
    });

    try {
        const results = await bulkTranslateKeys(
            keysToTranslate,
            targetLang,
            translationHistory,
            (p) => setProgress(p)
        );
        
        const suggestionsMap = results.reduce((acc, item) => {
            acc[item.key] = item.suggestion;
            return acc;
        }, {} as Record<string, string>);

        setSuggestions(suggestionsMap);

    } catch(e: any) {
        setError(e.message || "An unknown error occurred during translation.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleAcceptSuggestion = (key: string) => {
    if (suggestions[key]) {
      setEditedValues(prev => ({ ...prev, [key]: suggestions[key] }));
    }
  };

  const handleAcceptAll = () => {
    const newEdits = { ...editedValues };
    for (const key in suggestions) {
      const currentValue = newEdits[key] ?? String(getValueByPath(files.find(f => f.name === targetLang)?.data, key) ?? '');
      if (suggestions[key] && suggestions[key] !== currentValue) {
          newEdits[key] = suggestions[key];
      }
    }
    setEditedValues(newEdits);
  };
  
  const handleSave = () => {
    if (Object.keys(editedValues).length === 0) {
        alert("No changes to save.");
        return;
    }
    onSave(targetLang, editedValues);
    alert(`Saved ${Object.keys(editedValues).length} changes for language: ${targetLang}`);
    setEditedValues({});
  };
  
  const hasPendingChanges = Object.keys(editedValues).length > 0;
  const hasSuggestions = Object.keys(suggestions).length > 0;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
        <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800/50 space-y-4">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
                <LanguageIcon className="w-6 h-6 text-teal-400" />
                <span>Bulk Translate Language</span>
            </h2>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <label htmlFor="target-lang" className="block text-sm font-medium text-gray-300 mb-2">
                        Select Target Language
                    </label>
                    <select
                        id="target-lang"
                        value={targetLang}
                        onChange={e => setTargetLang(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    >
                        {targetLangs.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                </div>
                <div className="flex items-center space-x-2">
                    {hasSuggestions && (
                        <button onClick={handleAcceptAll} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md">Accept All</button>
                    )}
                     <button
                        onClick={handleGenerateSuggestions}
                        disabled={isLoading || !targetLang}
                        className="flex items-center space-x-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        <SparklesIcon className="w-5 h-5"/>
                        <span>{isLoading ? 'Generating...' : 'Generate All Suggestions'}</span>
                    </button>
                </div>
            </div>
             {isLoading && (
                 <div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 text-right mt-1">{progress.current} / {progress.total} keys processed</p>
                 </div>
             )}
             {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md">
                    <h3 className="font-bold">Translation Failed</h3>
                    <p className="text-sm">{error}</p>
                </div>
             )}
        </div>
        <div className="flex-grow overflow-y-auto">
             <table className="w-full text-sm text-left table-fixed">
                <thead className="sticky top-0 bg-gray-800 z-10">
                    <tr>
                        <th className="p-2 w-1/4">Key</th>
                        <th className="p-2 w-1/4">Polish (Source)</th>
                        <th className="p-2 w-1/4">Current Value ({targetLang})</th>
                        <th className="p-2 w-1/4">AI Suggestion</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {tableData.map(({ key, pl, currentValue, suggestion }) => (
                        <tr key={key} className="hover:bg-gray-800/50">
                            <td className="p-2 font-mono text-xs text-teal-300 break-words align-top">{key}</td>
                            <td className="p-2 text-gray-400 break-words align-top">{pl}</td>
                            <td className="p-2 align-top">
                                <textarea
                                    value={currentValue}
                                    onChange={(e) => setEditedValues(prev => ({ ...prev, [key]: e.target.value}))}
                                    className="w-full bg-transparent p-1 border border-transparent hover:border-gray-600 focus:border-teal-500 rounded resize-y"
                                    rows={2}
                                />
                            </td>
                            <td className="p-2 text-green-300 break-words align-top">
                                {suggestion && (
                                    <div className="flex justify-between items-start gap-2">
                                        <p className="flex-grow">{suggestion}</p>
                                        {currentValue !== suggestion && (
                                            <button 
                                                onClick={() => handleAcceptSuggestion(key)} 
                                                title="Accept Suggestion"
                                                className="p-1 text-teal-400 hover:text-white hover:bg-teal-600 rounded"
                                            >
                                                <CheckIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
        {hasPendingChanges && (
            <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-800/50 flex justify-between items-center">
                <p className="text-sm text-yellow-300">{Object.keys(editedValues).length} unsaved change(s).</p>
                <button onClick={handleSave} className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md">
                    <DownloadIcon className="w-5 h-5"/>
                    <span>Save Changes for {targetLang}</span>
                </button>
            </div>
        )}
    </div>
  );
};
