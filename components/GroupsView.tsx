import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory, TranslationGroup, AIAnalysisResult } from '../types';
import { getValueByPath } from '../services/translationService';
import { analyzeTranslations, buildAnalysisPrompt } from '../services/aiService';
import { SparklesIcon, CollectionIcon, EditIcon, StarIcon, CodeBracketIcon, ChevronDownIcon, ChevronUpIcon, ClipboardIcon, CheckIcon, BoltIcon } from './Icons';
import { TranslationAnalysisCard } from './TranslationAnalysisCard';
import { PromptViewerModal } from './PromptViewerModal';
import { GroupEditorForm } from './GroupEditorForm';

type GroupMode = 'list' | 'create' | 'edit';

interface GroupsViewProps {
    allKeys: string[];
    files: TranslationFile[];
    contexts: Record<string, any>;
    translationHistory: TranslationHistory;
    groups: TranslationGroup[];
    onUpdateGroups: (groups: TranslationGroup[]) => void;
    onUpdateValue: (fileName: string, key: string, newValue: any) => void;
    onUpdateContext: (key: string, newContext: string) => void;
    groupMode: GroupMode;
    selectedGroupId: string | null;
    onSetGroupMode: (mode: GroupMode) => void;
    onSetSelectedGroupId: (groupId: string | null) => void;
    globalContext: string;
}

export const GroupsView: React.FC<GroupsViewProps> = (props) => {
    const { 
        allKeys, files, contexts, groups, onUpdateGroups, 
        groupMode, selectedGroupId, onSetGroupMode, onSetSelectedGroupId,
    } = props;
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisData, setAnalysisData] = useState<Record<string, {
        result: AIAnalysisResult | null;
        error: string | null;
    }>>({});
    const [collapsedKeys, setCollapsedKeys] = useState(new Set<string>());
    
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [promptModalSubtitle, setPromptModalSubtitle] = useState('');
    const [copied, setCopied] = useState(false);

    const polishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish')), [files]);
    const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);

    useEffect(() => {
        setAnalysisData({});
        setIsAnalyzing(false);
        setCollapsedKeys(new Set());
    }, [selectedGroupId]);
    
    const unappliedSuggestions = useMemo(() => {
        const suggestions: { key: string; lang: string; suggestion: string }[] = [];
        if (!analysisData) return suggestions;

        Object.entries(analysisData).forEach(([key, analysis]) => {
            if (analysis.result?.analysis) {
                analysis.result.analysis.forEach(item => {
                    if (item.suggestion) {
                        const file = files.find(f => f.name === item.language);
                        if (file) {
                            const currentValue = getValueByPath(file.data, key);
                            if (currentValue !== item.suggestion) {
                                suggestions.push({ key, lang: item.language, suggestion: item.suggestion });
                            }
                        }
                    }
                });
            }
        });
        return suggestions;
    }, [analysisData, files]);

    const handleApplyAllSuggestions = () => {
        unappliedSuggestions.forEach(({ key, lang, suggestion }) => {
            props.onUpdateValue(lang, key, suggestion);
        });

        const newAnalysisData = JSON.parse(JSON.stringify(analysisData));
        Object.keys(newAnalysisData).forEach(key => {
            const analysis = newAnalysisData[key];
            if (analysis.result) {
                analysis.result.analysis = analysis.result.analysis.map((item: any) => {
                    if (item.suggestion) {
                        return { ...item, evaluation: 'Good', suggestion: undefined };
                    }
                    return item;
                });
            }
        });
        setAnalysisData(newAnalysisData);
    };

    const handleSaveGroup = (groupData: Omit<TranslationGroup, 'id'>) => {
        if (groupMode === 'create') {
            const newGroup: TranslationGroup = {
                id: String(Date.now()),
                ...groupData,
            };
            onUpdateGroups([...groups, newGroup]);
            onSetSelectedGroupId(newGroup.id);
            onSetGroupMode('list');

        } else if (groupMode === 'edit' && selectedGroupId) {
            const updatedGroups = groups.map(g => 
                g.id === selectedGroupId ? {
                    ...g,
                    ...groupData,
                } : g
            );
            onUpdateGroups(updatedGroups);
            onSetSelectedGroupId(selectedGroupId);
            onSetGroupMode('list');
        }
    };
    
    const handleCopyAllKeys = (group: TranslationGroup) => {
        const keysString = group.keys.join('\n');
        navigator.clipboard.writeText(keysString).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

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
    
    const handleCollapseAll = (group: TranslationGroup) => setCollapsedKeys(new Set(group.keys));
    const handleExpandAll = () => setCollapsedKeys(new Set());

    const handleShowPrompt = (group: TranslationGroup) => {
        if (group.keys.length === 0 || !polishFile) return;
        const sampleKey = group.keys[0];
        
        const referenceTranslations = group.referenceKeys.map(refKey => ({
            key: refKey,
            translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
        }));
        
        const polishValue = String(getValueByPath(polishFile.data, sampleKey) || '');
        const englishValue = englishFile ? String(getValueByPath(englishFile.data, sampleKey) || '') : '';
        const englishTranslation = englishFile ? { lang: englishFile.name, value: englishValue } : null;
        const otherTranslations = props.files
            .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
            .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, sampleKey) || '') }));
            
        const prompt = buildAnalysisPrompt(
            sampleKey, group.context, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations,
            props.translationHistory, referenceTranslations, props.globalContext
        );

        setGeneratedPrompt(prompt);
        setPromptModalSubtitle(`This is an example prompt for the first key in the group: '${sampleKey}'`);
        setIsPromptModalOpen(true);
    };

    const handleAnalyzeGroup = async (group: TranslationGroup) => {
        if (!polishFile) {
            alert("Polish reference file not found.");
            return;
        }
        setIsAnalyzing(true);
        setAnalysisData({});

        const referenceTranslations = group.referenceKeys.map(refKey => ({
            key: refKey,
            translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
        }));

        const analysisPromises = group.keys.map(key => {
            const polishValue = String(getValueByPath(polishFile.data, key) || '');
            const englishValue = englishFile ? String(getValueByPath(englishFile.data, key) || '') : '';
            const englishTranslation = englishFile ? { lang: englishFile.name, value: englishValue } : null;
            const otherTranslations = props.files
                .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
                .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, key) || '') }));
            
            return analyzeTranslations(
                key, group.context, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations,
                props.translationHistory, referenceTranslations, props.globalContext
            )
            .then(result => ({ key, status: 'fulfilled' as const, value: result }))
            .catch(error => ({ key, status: 'rejected' as const, reason: error as Error }));
        });
        
        const results = await Promise.all(analysisPromises);
        const newAnalysisData: typeof analysisData = {};

        for (const result of results) {
            if (!result) continue;
            // FIX: The original code was assigning to a property of an undefined object.
            // This now correctly assigns a new object for each analysis result.
            if (result.status === 'fulfilled') {
                newAnalysisData[result.key] = {
                    result: result.value,
                    error: null,
                };
            } else { // 'rejected'
                newAnalysisData[result.key] = {
                    result: null,
                    error: result.reason.message,
                };
            }
        }
        setAnalysisData(newAnalysisData);
        setIsAnalyzing(false);
    };
    
    if (groupMode === 'create' || groupMode === 'edit') {
        return (
            <GroupEditorForm
                allKeys={allKeys}
                files={files}
                contexts={contexts}
                onUpdateValue={props.onUpdateValue}
                onUpdateContext={props.onUpdateContext}
                onSave={handleSaveGroup}
                onCancel={() => onSetGroupMode('list')}
                initialData={groups.find(g => g.id === selectedGroupId)}
                mode={groupMode}
            />
        );
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    if (!selectedGroup) {
      return (
        <div className="flex items-center justify-center h-full text-center">
            <div>
                <CollectionIcon className="w-16 h-16 mx-auto text-gray-600"/>
                <h2 className="mt-4 text-xl font-semibold text-gray-300">Context Groups</h2>
                <p className="mt-2 text-gray-500">Select a group from the list or create a new one to begin.</p>
            </div>
        </div>
      );
    }

    return (
         <div className="flex flex-col h-full">
            <PromptViewerModal
                isOpen={isPromptModalOpen}
                onClose={() => setIsPromptModalOpen(false)}
                prompt={generatedPrompt}
                title="Sample AI Prompt"
                subtitle={promptModalSubtitle}
            />
            <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800/50 space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-100">
                            Group: <span className="text-teal-400">{selectedGroup.name}</span> ({selectedGroup.keys.length} keys)
                        </h2>
                        <div className="flex items-center space-x-2 mt-2 flex-wrap gap-y-2">
                            {selectedGroup.referenceKeys.map(key => (
                                <div key={key} className="flex items-center space-x-1 bg-yellow-900/50 text-yellow-300 text-xs font-semibold px-2 py-1 rounded-full" title="Reference Key">
                                    <StarIcon className="w-3 h-3"/>
                                    <span>{key}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                     <button onClick={() => onSetGroupMode('edit')} className="flex items-center space-x-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md transition-colors">
                        <EditIcon className="w-4 h-4" />
                        <span>Edit Group</span>
                    </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                     <div className="flex items-center gap-2">
                         <button onClick={handleExpandAll} className="text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-gray-200">Expand All</button>
                         <button onClick={() => handleCollapseAll(selectedGroup)} className="text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-gray-200">Collapse All</button>
                         <button
                            onClick={() => handleCopyAllKeys(selectedGroup)}
                            className={`text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                                copied
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            }`}
                            >
                            {copied ? ( <> <CheckIcon className="w-4 h-4" /> <span>Copied!</span> </> ) 
                            : ( <> <ClipboardIcon className="w-4 h-4" /> <span>Copy All Keys</span> </> )}
                        </button>
                    </div>
                    <div className="flex items-end space-x-2">
                         {unappliedSuggestions.length > 0 && !isAnalyzing && (
                            <button
                                onClick={handleApplyAllSuggestions}
                                className="flex items-center space-x-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md transition-colors"
                            >
                                <BoltIcon className="w-5 h-5" />
                                <span>Apply All ({unappliedSuggestions.length})</span>
                            </button>
                         )}
                         <button
                            onClick={() => handleShowPrompt(selectedGroup)}
                            disabled={isAnalyzing}
                            className="p-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors disabled:bg-gray-600"
                            title="Show sample prompt"
                        >
                            <CodeBracketIcon className="w-5 h-5"/>
                        </button>
                        <button 
                            onClick={() => handleAnalyzeGroup(selectedGroup)}
                            disabled={isAnalyzing}
                            className="flex items-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:bg-gray-600"
                        >
                            <SparklesIcon className="w-5 h-5"/>
                            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Group'}</span>
                        </button>
                    </div>
                </div>
                 <p className="text-sm text-gray-400 bg-gray-900 p-2 rounded-md border border-gray-700">
                   <span className="font-semibold text-gray-300">Context: </span> "{selectedGroup.context}"
                </p>
            </div>
            <div className="flex-grow overflow-y-auto p-4 lg:p-6 space-y-6 bg-gray-900">
                {selectedGroup.keys.map(key => {
                    const keyAnalysis = analysisData[key];
                    const referenceTranslations = selectedGroup.referenceKeys.map(refKey => ({
                        key: refKey,
                        translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
                    }));
                    return (
                        <TranslationAnalysisCard
                            key={key}
                            translationKey={key}
                            files={props.files}
                            context={selectedGroup.context} 
                            translationHistory={props.translationHistory}
                            onUpdateValue={props.onUpdateValue}
                            onUpdateContext={() => {}}
                            showFilePreview={false}
                            showAnalysisControls={false}
                            analysisResult={keyAnalysis?.result}
                            error={keyAnalysis?.error}
                            isLoading={isAnalyzing && !keyAnalysis}
                            isCollapsed={collapsedKeys.has(key)}
                            onToggleCollapse={handleToggleCollapse}
                            groupReferenceTranslations={referenceTranslations}
                            globalContext={props.globalContext}
                        />
                    );
                })}
            </div>
        </div>
    );
};