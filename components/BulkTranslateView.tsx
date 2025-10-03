import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory, AnalysisItem } from '../types';
import { getValueByPath } from '../services/translationService';
import { analyzeKeyForLanguage } from '../services/aiService';
import { LanguageIcon, SparklesIcon, DownloadIcon, GlobeAltIcon, PlusCircleIcon, CloseIcon, SearchIcon } from './Icons';
import { GlobalContextModal } from './GlobalContextModal';
import { BulkTableRow } from './BulkTableRow';

interface BulkTranslateViewProps {
  allKeys: string[];
  files: TranslationFile[];
  contexts: Record<string, any>;
  translationHistory: TranslationHistory;
  onSave: (updatedValuesByLang: Record<string, Record<string, string>>) => void;
  globalContext: string;
  onUpdateGlobalContext: (context: string) => void;
  onUpdateContext: (key: string, newContext: string) => void;
  referenceKeys: string[];
  onToggleReferenceKey: (key: string) => void;
}

export const BulkTranslateView: React.FC<BulkTranslateViewProps> = (props) => {
  const { allKeys, files, contexts, translationHistory, onSave, globalContext, onUpdateGlobalContext, onUpdateContext, referenceKeys, onToggleReferenceKey } = props;

  const [isGlobalContextModalOpen, setIsGlobalContextModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [editedValues, setEditedValues] = useState<Record<string, Record<string, string>>>({});
  const [analysisData, setAnalysisData] = useState<Record<string, Record<string, AnalysisItem | null>>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const polishFile = useMemo(() => files.find(f => f.name.toLowerCase() === 'pl' || f.name.toLowerCase() === 'polish'), [files]);
  const englishFile = useMemo(() => files.find(f => f.name.toLowerCase() === 'en' || f.name.toLowerCase() === 'english'), [files]);
  
  const [visibleLangs, setVisibleLangs] = useState<string[]>([]);

  useEffect(() => {
    const defaultLangs: string[] = [];
    if (polishFile) defaultLangs.push(polishFile.name);
    if (englishFile) defaultLangs.push(englishFile.name);
    setVisibleLangs(defaultLangs);
  }, [polishFile, englishFile]);

  const filteredKeys = useMemo(() => {
    if (!searchTerm) return allKeys;
    
    const lowercasedQuery = searchTerm.toLowerCase();
    
    return allKeys.filter(key => {
        const keyMatch = key.toLowerCase().includes(lowercasedQuery);
        if (keyMatch) return true;

        if (polishFile) {
            const value = getValueByPath(polishFile.data, key);
            if (typeof value === 'string' && value.toLowerCase().includes(lowercasedQuery)) {
                return true;
            }
        }
        
        return false;
    });
  }, [allKeys, searchTerm, polishFile]);

  const availableLangsToAdd = useMemo(() => {
    return files.map(f => f.name).filter(name => !visibleLangs.includes(name)).sort();
  }, [files, visibleLangs]);
  
  const handleGenerateAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisData({});

    const keysToAnalyze = filteredKeys;
    const langsToAnalyze = visibleLangs;
    
    const referenceTranslations = referenceKeys.map(refKey => ({
        key: refKey,
        translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
    }));

    const allValuesByKey: Record<string, Record<string, { lang: string, value: string }>> = {};
    keysToAnalyze.forEach(key => {
        allValuesByKey[key] = {};
        files.forEach(file => {
            allValuesByKey[key][file.name] = {
                lang: file.name,
                value: String(getValueByPath(file.data, key) ?? ''),
            };
        });
    });

    // Create a flat list of all analysis tasks
    const tasks: { key: string, lang: string }[] = [];
    for (const key of keysToAnalyze) {
        for (const lang of langsToAnalyze) {
            tasks.push({ key, lang });
        }
    }
    
    // Process tasks concurrently
    const results = await Promise.all(tasks.map(async ({ key, lang }) => {
        const context = String(getValueByPath(contexts, key) ?? '');
        const analysis = await analyzeKeyForLanguage(key, lang, allValuesByKey[key], context, translationHistory, globalContext, referenceTranslations);
        return { key, lang, analysis };
    }));

    // Populate the analysis data state
    const newAnalysisData: typeof analysisData = {};
    results.forEach(({ key, lang, analysis }) => {
        if (!newAnalysisData[key]) {
            newAnalysisData[key] = {};
        }
        newAnalysisData[key][lang] = analysis;
    });
    
    setAnalysisData(newAnalysisData);
    setIsLoading(false);
  };

  const handleValueChange = (key: string, lang: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        [key]: value
      }
    }));
  };

  const handleSave = () => {
    if (Object.keys(editedValues).length === 0) return;
    onSave(editedValues);
    setEditedValues({});
    setAnalysisData({});
  };
  
  const hasPendingChanges = Object.keys(editedValues).some(lang => Object.keys(editedValues[lang]).length > 0);

  return (
    <>
    <GlobalContextModal 
        isOpen={isGlobalContextModalOpen}
        onClose={() => setIsGlobalContextModalOpen(false)}
        context={globalContext}
        onUpdateContext={onUpdateGlobalContext}
    />
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
        <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800/50 space-y-4">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
                <LanguageIcon className="w-6 h-6 text-teal-400" />
                <span>Bulk Translation Editor</span>
            </h2>
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
            <div className="flex items-end justify-between gap-4">
                <div className="flex items-end gap-2">
                    <button onClick={() => setIsGlobalContextModalOpen(true)} className="flex items-center space-x-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md">
                        <GlobeAltIcon className="w-5 h-5" /><span>Global Context</span>
                    </button>
                    {availableLangsToAdd.length > 0 && (
                        <div className="group relative">
                            <button className="flex items-center space-x-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md">
                                <PlusCircleIcon className="w-5 h-5"/> <span>Add Language</span>
                            </button>
                            <div className="absolute top-full left-0 mt-1 z-20 bg-gray-700 rounded-md shadow-lg hidden group-hover:block w-40">
                                {availableLangsToAdd.map(lang => (
                                    <button
                                        key={lang}
                                        onClick={() => setVisibleLangs(prev => [...prev, lang])}
                                        className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 first:rounded-t-md last:rounded-b-md"
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                     <button
                        onClick={handleGenerateAnalysis} disabled={isLoading}
                        className="flex items-center space-x-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        <SparklesIcon className="w-5 h-5"/>
                        <span>{isLoading ? 'Analyzing...' : `Generate & Analyze`}</span>
                    </button>
                </div>
            </div>
             {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md">
                    <h3 className="font-bold">Analysis Failed</h3><p className="text-sm">{error}</p>
                </div>
             )}
        </div>

        <div className="flex-grow overflow-auto">
            <table className="w-full text-sm text-left border-separate border-spacing-0">
                <thead className="sticky top-0 bg-gray-800/90 backdrop-blur-sm z-10">
                    <tr>
                        <th className="p-2 w-[250px] min-w-[250px] font-semibold sticky left-0 z-20 bg-gray-800/90 border-b border-gray-700">Key & Context</th>
                        <th className="p-2 w-12 font-semibold text-center sticky left-[250px] z-20 bg-gray-800/90 border-b border-gray-700">Ref</th>
                        {visibleLangs.map(lang => (
                           <th 
                            key={lang}
                            className={`p-2 w-[350px] min-w-[350px] font-semibold border-b border-gray-700 
                            ${lang === polishFile?.name ? 'sticky left-[298px] z-20 bg-gray-800/90' : ''}`}
                           >
                            <div className="flex items-center justify-between">
                                <span>{lang} {lang === polishFile?.name ? '(Source)' : lang === englishFile?.name ? '(Reference)' : ''}</span>
                                {lang !== polishFile?.name && lang !== englishFile?.name && (
                                    <button 
                                        onClick={() => setVisibleLangs(prev => prev.filter(l => l !== lang))}
                                        className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"
                                        title={`Remove ${lang} column`}
                                    >
                                        <CloseIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                           </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {filteredKeys.map(key => (
                      <BulkTableRow
                        key={key}
                        translationKey={key}
                        visibleLangs={visibleLangs}
                        files={files}
                        contexts={contexts}
                        editedValues={editedValues}
                        analysisData={analysisData[key]}
                        onValueChange={handleValueChange}
                        onContextChange={onUpdateContext}
                        isLoading={isLoading}
                        polishLangName={polishFile?.name || 'pl'}
                        isReference={referenceKeys.includes(key)}
                        onToggleReference={() => onToggleReferenceKey(key)}
                      />
                    ))}
                </tbody>
            </table>
        </div>
        
        {hasPendingChanges && (
            <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-800/50 flex justify-between items-center">
                <p className="text-sm text-yellow-300">Unsaved changes detected.</p>
                <button onClick={handleSave} className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md">
                    <DownloadIcon className="w-5 h-5"/><span>Save All Changes</span>
                </button>
            </div>
        )}
    </div>
    </>
  );
};
