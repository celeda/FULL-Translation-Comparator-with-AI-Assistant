
import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory } from '../types';
import { getValueByPath } from '../services/translationService';
import { bulkTranslateKeys } from '../services/aiService';
import { LanguageIcon, SparklesIcon, DownloadIcon, GlobeAltIcon, CheckIcon, BoltIcon } from './Icons';
import { GlobalContextModal } from './GlobalContextModal';

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
  const [globalContext, setGlobalContext] = useState<string>('');
  const [isGlobalContextModalOpen, setIsGlobalContextModalOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(new Set());

  const polishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish')), [files]);
  const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);
  
  const targetLangs = useMemo(() => 
    files.filter(f => f.name !== polishFile?.name && f.name !== englishFile?.name).map(f => f.name).sort()
  , [files, polishFile, englishFile]);
  
  const targetFile = useMemo(() => files.find(f => f.name === targetLang), [files, targetLang]);

  useEffect(() => {
    if (targetLangs.length > 0 && !targetLang) {
      setTargetLang(targetLangs[0]);
    }
  }, [targetLangs, targetLang]);
  
  useEffect(() => {
    setEditedValues({});
    setSuggestions({});
    setAcceptedKeys(new Set());
    setError(null);
    setIsLoading(false);
  }, [targetLang]);
  
  const handleGenerateSuggestions = async () => {
    if (!targetLang || !polishFile) {
        setError("Cannot generate suggestions without a target language and a Polish source file.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setSuggestions({});
    setEditedValues({});
    setAcceptedKeys(new Set());
    setProgress({ current: 0, total: allKeys.length });

    const keysToTranslate = allKeys.map(key => ({
        key,
        pl: String(getValueByPath(polishFile.data, key) ?? ''),
        en: String(getValueByPath(englishFile?.data, key) ?? ''),
        context: String(getValueByPath(contexts, key) ?? ''),
        currentValue: String(getValueByPath(targetFile?.data, key) ?? ''),
    }));

    try {
        const results = await bulkTranslateKeys(keysToTranslate, targetLang, translationHistory, globalContext, setProgress);
        
        const suggestionsMap: Record<string, string> = {};
        results.forEach(item => { suggestionsMap[item.key] = item.suggestion; });
        setSuggestions(suggestionsMap);

    } catch(e: any) {
        setError(e.message || "An unknown error occurred during translation.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleAcceptSuggestion = (key: string, suggestion: string) => {
    handleValueChange(key, suggestion);
    setAcceptedKeys(prev => new Set(prev).add(key));
  };

  const handleAcceptAll = () => {
    const newEdits = { ...editedValues };
    const newAccepted = new Set(acceptedKeys);
    allKeys.forEach(key => {
        const suggestion = suggestions[key];
        if (suggestion) {
            const currentValue = editedValues[key] ?? getValueByPath(targetFile?.data, key) ?? '';
            if (suggestion !== currentValue) {
                newEdits[key] = suggestion;
                newAccepted.add(key);
            }
        }
    });
    setEditedValues(newEdits);
    setAcceptedKeys(newAccepted);
  };
  
  const handleSave = () => {
    if (Object.keys(editedValues).length === 0) return;
    onSave(targetLang, editedValues);
    setEditedValues({});
    setAcceptedKeys(new Set());
    setSuggestions({}); // Clear suggestions after saving
  };
  
  const hasPendingChanges = Object.keys(editedValues).length > 0;
  const hasSuggestions = Object.keys(suggestions).length > 0;

  return (
    <>
    <GlobalContextModal 
        isOpen={isGlobalContextModalOpen}
        onClose={() => setIsGlobalContextModalOpen(false)}
        context={globalContext}
        onUpdateContext={setGlobalContext}
    />
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
        <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800/50 space-y-4">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
                <LanguageIcon className="w-6 h-6 text-teal-400" />
                <span>Bulk Translation Editor</span>
            </h2>
            <div className="flex items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                    <div>
                        <label htmlFor="target-lang" className="block text-sm font-medium text-gray-300 mb-2">Target Language</label>
                        <select
                            id="target-lang" value={targetLang} onChange={e => setTargetLang(e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200"
                        >
                            {targetLangs.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                        </select>
                    </div>
                     <button onClick={() => setIsGlobalContextModalOpen(true)} className="flex items-center space-x-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md">
                        <GlobeAltIcon className="w-5 h-5" /><span>Global Context</span>
                    </button>
                </div>
                <div className="flex items-center space-x-2">
                     <button
                        onClick={handleGenerateSuggestions} disabled={isLoading || !targetLang}
                        className="flex items-center space-x-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-600"
                    >
                        <SparklesIcon className="w-5 h-5"/>
                        <span>{isLoading ? 'Generating...' : `Generate & Analyze ${targetLang}`}</span>
                    </button>
                </div>
            </div>
             {isLoading && (
                 <div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div></div>
                    <p className="text-xs text-gray-400 text-right mt-1">{progress.current} / {progress.total} keys processed</p>
                 </div>
             )}
             {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md">
                    <h3 className="font-bold">Translation Failed</h3><p className="text-sm">{error}</p>
                </div>
             )}
             {hasSuggestions && !isLoading && (
                 <div className="flex justify-end">
                    <button onClick={handleAcceptAll} className="flex items-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-3 rounded-md">
                        <BoltIcon className="w-4 h-4" /><span>Accept All Suggestions</span>
                    </button>
                 </div>
             )}
        </div>

        <div className="flex-grow overflow-y-auto">
            <table className="w-full text-sm text-left table-fixed">
                <thead className="sticky top-0 bg-gray-800/90 backdrop-blur-sm z-10">
                    <tr>
                        <th className="p-2 w-[20%] font-semibold">Key & Context</th>
                        <th className="p-2 w-[20%] font-semibold">Polish (Source)</th>
                        <th className="p-2 w-[20%] font-semibold">English (Reference)</th>
                        <th className="p-2 w-[20%] font-semibold">{targetLang || 'Target Language'}</th>
                        <th className="p-2 w-[20%] font-semibold">AI Suggestion</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {allKeys.map(key => {
                        const context = String(getValueByPath(contexts, key) || '');
                        const plValue = String(getValueByPath(polishFile?.data, key) ?? '');
                        const enValue = String(getValueByPath(englishFile?.data, key) ?? '');
                        const currentValue = editedValues[key] ?? String(getValueByPath(targetFile?.data, key) ?? '');
                        const suggestion = suggestions[key];
                        const isAccepted = acceptedKeys.has(key);

                        return (
                            <tr key={key} className={isAccepted ? 'bg-green-900/10' : ''}>
                                <td className="p-2 align-top break-words">
                                    <p className="font-mono text-teal-300">{key}</p>
                                    <p className="text-xs text-gray-400 italic mt-1">{context}</p>
                                </td>
                                <td className="p-2 align-top text-gray-300 break-words">{plValue}</td>
                                <td className="p-2 align-top text-gray-300 break-words">{enValue}</td>
                                <td className="p-2 align-top">
                                    <textarea value={currentValue} onChange={e => handleValueChange(key, e.target.value)}
                                        className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-1 text-gray-200 resize-y" rows={3}/>
                                </td>
                                <td className="p-2 align-top">
                                    {isLoading && !suggestion && <div className="text-gray-500">...</div>}
                                    {suggestion && (
                                        <div className="bg-gray-900/50 p-2 rounded-md h-full flex flex-col justify-between">
                                            <p className="text-green-300 break-words flex-grow">{suggestion}</p>
                                            {!isAccepted && suggestion !== currentValue && (
                                                <button onClick={() => handleAcceptSuggestion(key, suggestion)} className="text-xs bg-teal-700 hover:bg-teal-600 text-white font-semibold py-1 px-2 rounded-md mt-2 self-start">
                                                    Accept
                                                </button>
                                            )}
                                            {isAccepted && (
                                                <div className="flex items-center space-x-1 text-green-400 font-semibold text-xs mt-2 self-start">
                                                    <CheckIcon className="w-4 h-4"/><span>Accepted</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        
        {hasPendingChanges && (
            <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-800/50 flex justify-between items-center">
                <p className="text-sm text-yellow-300">{Object.keys(editedValues).length} changes ready to be saved for {targetLang}.</p>
                <button onClick={handleSave} className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md">
                    <DownloadIcon className="w-5 h-5"/><span>Save Changes</span>
                </button>
            </div>
        )}
    </div>
    </>
  );
};
