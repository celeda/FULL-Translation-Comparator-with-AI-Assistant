
import React, { useState, useRef, useEffect } from 'react';
import type { TranslationFile, TranslationHistory, AIAnalysisResult, Glossary } from '../types';
import { TranslationAnalysisCard } from './TranslationAnalysisCard';
import { getValueByPath } from '../services/translationService';
import { analyzeTranslations, buildAnalysisPrompt } from '../services/aiService';
import { SparklesIcon, CodeBracketIcon } from './Icons';
import { PromptViewerModal } from './PromptViewerModal';

interface ValueSearchResultsViewProps {
  keys: string[];
  searchQuery: { term: string; lang: string } | null;
  files: TranslationFile[];
  contexts: Record<string, any>;
  translationHistory: TranslationHistory;
  onUpdateValue: (fileName: string, key: string, newValue: any) => void;
  onUpdateContext: (key: string, newContext: string) => void;
  glossary: Glossary;
}

export const ValueSearchResultsView: React.FC<ValueSearchResultsViewProps> = (props) => {
    const { keys, searchQuery, glossary } = props;
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
    const [analysisData, setAnalysisData] = useState<Record<string, {
        result: AIAnalysisResult | null;
        error: string | null;
    }>>({});
    const [collapsedKeys, setCollapsedKeys] = useState(new Set<string>());
    
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    useEffect(() => {
        // Reset analysis and collapse state when search query changes
        setAnalysisData({});
        setIsAnalyzingAll(false);
        setCollapsedKeys(new Set());
    }, [searchQuery]);

    const handleToggleCollapse = (key: string) => {
        setCollapsedKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const handleCollapseAll = () => setCollapsedKeys(new Set(keys));
    const handleExpandAll = () => setCollapsedKeys(new Set());

    const handleShowPrompt = () => {
        if (keys.length === 0) return;
        const sampleKey = keys[0];

        const polishFile = props.files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish'));
        if (!polishFile) return;

        const englishFile = props.files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english'));

        const context = getValueByPath(props.contexts, sampleKey) || '';
        const polishValue = String(getValueByPath(polishFile.data, sampleKey) || '');
        const englishTranslation = englishFile ? { lang: englishFile.name, value: String(getValueByPath(englishFile.data, sampleKey) || '') } : null;
        const otherTranslations = props.files
            .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
            .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, sampleKey) || '') }));
        
        const prompt = buildAnalysisPrompt(
            sampleKey, context, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations,
            props.translationHistory,
            glossary
        );
        
        setGeneratedPrompt(prompt);
        setIsPromptModalOpen(true);
    };

    const handleAnalyzeAll = async () => {
        setIsAnalyzingAll(true);
        setAnalysisData({});

        const polishFile = props.files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish'));
        if (!polishFile) {
            console.error("Polish reference file not found.");
            setIsAnalyzingAll(false);
            return;
        }
        const englishFile = props.files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english'));

        const analysisPromises = keys.map(key => {
            const context = getValueByPath(props.contexts, key) || '';
            const polishValue = String(getValueByPath(polishFile.data, key) || '');
            const englishTranslation = englishFile ? { lang: englishFile.name, value: String(getValueByPath(englishFile.data, key) || '') } : null;
            const otherTranslations = props.files
                .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
                .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, key) || '') }));
            
            return analyzeTranslations(
                key, context, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations,
                props.translationHistory,
                glossary
            )
            .then(result => ({ key, status: 'fulfilled', value: result }))
            .catch(error => ({ key, status: 'rejected', reason: error as Error }));
        });

        const results = await Promise.all(analysisPromises);

        const newAnalysisData: typeof analysisData = {};
        for (const result of results) {
            if (!newAnalysisData[result.key]) {
                newAnalysisData[result.key] = { result: null, error: null };
            }
            
            if (result.status === 'fulfilled' && 'value' in result) {
                newAnalysisData[result.key].result = result.value;
            } else if (result.status === 'rejected' && 'reason' in result) {
                newAnalysisData[result.key].error = result.reason.message;
            }
        }

        setAnalysisData(newAnalysisData);
        setIsAnalyzingAll(false);
    };

    if (!searchQuery) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-800/30 rounded-lg m-8">
                <p className="text-gray-500">Perform a search by value from the left panel.</p>
            </div>
        );
    }
    
    if (keys.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-800/30 rounded-lg m-8">
                <p className="text-gray-500">No results found for "{searchQuery.term}" in language "{searchQuery.lang}".</p>
            </div>
        );
    }

    return (
        <>
        <PromptViewerModal
            isOpen={isPromptModalOpen}
            onClose={() => setIsPromptModalOpen(false)}
            prompt={generatedPrompt}
            title="Sample AI Prompt"
            subtitle={`This is an example prompt for the first key in the list: '${keys[0]}'`}
        />
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800/50 space-y-4">
                <h2 className="text-lg font-semibold text-gray-100">
                    {keys.length} result(s) for <span className="text-teal-400 font-semibold">"{searchQuery.term}"</span> in language <span className="text-teal-400 font-semibold">{searchQuery.lang}</span>
                </h2>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                         <button onClick={handleExpandAll} className="text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-gray-200">Expand All</button>
                         <button onClick={handleCollapseAll} className="text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-gray-200">Collapse All</button>
                    </div>
                    <div className="flex items-end justify-end gap-2">
                        <button
                            onClick={handleShowPrompt}
                            disabled={isAnalyzingAll || keys.length === 0}
                            className="p-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Show a sample prompt for the first result"
                        >
                            <CodeBracketIcon className="w-5 h-5"/>
                        </button>
                        <button 
                            onClick={handleAnalyzeAll}
                            disabled={isAnalyzingAll}
                            className="flex items-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <SparklesIcon className="w-5 h-5"/>
                            <span>{isAnalyzingAll ? 'Analyzing All...' : `Analyze All (${keys.length})`}</span>
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-4 lg:p-6 space-y-6 bg-gray-900">
                {keys.map(key => {
                    const keyAnalysis = analysisData[key];
                    return (
                        <TranslationAnalysisCard
                            key={key}
                            translationKey={key}
                            files={props.files}
                            context={getValueByPath(props.contexts, key) || ''}
                            translationHistory={props.translationHistory}
                            onUpdateValue={props.onUpdateValue}
                            onUpdateContext={(newContext) => props.onUpdateContext(key, newContext)}
                            showFilePreview={false}
                            showAnalysisControls={false}
                            analysisResult={keyAnalysis?.result}
                            error={keyAnalysis?.error}
                            isLoading={isAnalyzingAll}
                            isCollapsed={collapsedKeys.has(key)}
                            onToggleCollapse={handleToggleCollapse}
                            glossary={glossary}
                        />
                    );
                })}
            </div>
        </div>
        </>
    );
};
