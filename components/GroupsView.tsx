
import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory, TranslationGroup, AIAnalysisResult, Glossary } from '../types';
import { getValueByPath } from '../services/translationService';
import { analyzeTranslations, buildAnalysisPrompt } from '../services/aiService';
import { SearchIcon, PlusCircleIcon, SparklesIcon, CollectionIcon, TrashIcon, EditIcon, StarIcon, CodeBracketIcon, ChevronDownIcon, ChevronUpIcon, ClipboardIcon, CheckIcon } from './Icons';
import { TranslationAnalysisCard } from './TranslationAnalysisCard';
import { PromptViewerModal } from './PromptViewerModal';

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
    glossary: Glossary;
}

const polishFileFinder = (f: TranslationFile) => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish');

// A controlled textarea component that saves on blur
const EditableValueTextarea: React.FC<{
    initialValue: string;
    onSave: (newValue: string) => void;
    fileFound: boolean;
    lang: string;
}> = ({ initialValue, onSave, fileFound, lang }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleBlur = () => {
        if (value !== initialValue) {
            onSave(value);
        }
    };

    return (
        <textarea
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-1 resize-y text-gray-300 focus:border-teal-500"
            placeholder={!fileFound ? `${lang} file not found` : ""}
            disabled={!fileFound}
        />
    );
};

export const GroupsView: React.FC<GroupsViewProps> = (props) => {
    const { 
        allKeys, files, contexts, groups, onUpdateGroups, 
        groupMode, selectedGroupId, onSetGroupMode, onSetSelectedGroupId,
        glossary,
    } = props;
    
    const [formState, setFormState] = useState({
        name: '',
        context: '',
        searchQuery: '',
        selectedKeys: new Set<string>(),
        referenceKeys: new Set<string>(),
    });

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

    const polishFile = useMemo(() => files.find(polishFileFinder), [files]);
    const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);


    useEffect(() => {
        if (groupMode === 'edit' && selectedGroupId) {
            const group = groups.find(g => g.id === selectedGroupId);
            if (group) {
                 setFormState({
                    name: group.name,
                    context: group.context,
                    searchQuery: '',
                    selectedKeys: new Set(group.keys),
                    referenceKeys: new Set(group.referenceKeys),
                });
            }
        } else if (groupMode === 'create') {
            resetForm();
        }
    }, [groupMode, selectedGroupId, groups]);

    useEffect(() => {
        setAnalysisData({});
        setIsAnalyzing(false);
        setCollapsedKeys(new Set());
    }, [selectedGroupId]);

    const resetForm = () => {
        setFormState({
            name: '', context: '', searchQuery: '',
            selectedKeys: new Set(), referenceKeys: new Set(),
        });
    };
    
    const handleCancelForm = () => {
        resetForm();
        onSetGroupMode('list');
    };
    
    const handleSaveGroup = () => {
        const { name, context, selectedKeys, referenceKeys } = formState;
        if (!name.trim() || selectedKeys.size === 0) {
            alert("Group name and at least one selected key are required.");
            return;
        }

        if (groupMode === 'create') {
            const newGroup: TranslationGroup = {
                id: String(Date.now()),
                name: name.trim(),
                context: context.trim(),
                keys: Array.from(selectedKeys),
                referenceKeys: Array.from(referenceKeys),
            };
            onUpdateGroups([...groups, newGroup]);
            onSetSelectedGroupId(newGroup.id);
            onSetGroupMode('list');

        } else if (groupMode === 'edit' && selectedGroupId) {
            const updatedGroups = groups.map(g => 
                g.id === selectedGroupId ? {
                    ...g,
                    name: name.trim(),
                    context: context.trim(),
                    keys: Array.from(selectedKeys),
                    referenceKeys: Array.from(referenceKeys),
                } : g
            );
            onUpdateGroups(updatedGroups);
            onSetSelectedGroupId(selectedGroupId);
            onSetGroupMode('list');
        }
    };
    
    const searchResults = useMemo(() => {
        const query = formState.searchQuery.trim();
        if (!query) return groupMode === 'edit' ? Array.from(formState.selectedKeys).sort() : [];

        const lowercasedQuery = query.toLowerCase();
        
        return allKeys.filter(key => {
            if (groupMode === 'edit' && formState.selectedKeys.has(key)) return true;

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
    }, [formState.searchQuery, formState.selectedKeys, allKeys, polishFile, groupMode]);
    
    const toggleKeySelection = (key: string) => {
        const newSelected = new Set(formState.selectedKeys);
        const newReferences = new Set(formState.referenceKeys);
        if (newSelected.has(key)) {
            newSelected.delete(key);
            newReferences.delete(key);
        } else {
            newSelected.add(key);
        }
        setFormState(s => ({ ...s, selectedKeys: newSelected, referenceKeys: newReferences }));
    };
    
    const toggleReferenceKey = (key: string) => {
        const newReferences = new Set(formState.referenceKeys);
        if (newReferences.has(key)) {
            newReferences.delete(key);
        } else {
            if (formState.selectedKeys.has(key)) {
                newReferences.add(key);
            }
        }
        setFormState(s => ({ ...s, referenceKeys: newReferences }));
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
        if (group.keys.length === 0) return;
        const sampleKey = group.keys[0];
        
        if (!polishFile) return;

        const referenceTranslations = group.referenceKeys.map(refKey => ({
            key: refKey,
            translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
        }));
        
        const polishValue = String(getValueByPath(polishFile.data, sampleKey) || '');
        const englishValue = String(getValueByPath(englishFile?.data, sampleKey) || '');
        const englishTranslation = englishFile ? { lang: englishFile.name, value: englishValue } : null;
        const otherTranslations = props.files
            .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
            .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, sampleKey) || '') }));
            
        const prompt = buildAnalysisPrompt(
            sampleKey, group.context, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations,
            props.translationHistory, referenceTranslations, glossary
        );

        setGeneratedPrompt(prompt);
        setPromptModalSubtitle(`This is an example prompt for the first key in the group: '${sampleKey}'`);
        setIsPromptModalOpen(true);
    };

    const handleAnalyzeGroup = async (group: TranslationGroup) => {
        setIsAnalyzing(true);
        setAnalysisData({});

        if (!polishFile) {
            alert("Polish reference file not found.");
            setIsAnalyzing(false);
            return;
        }
        
        const referenceTranslations = group.referenceKeys.map(refKey => ({
            key: refKey,
            translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
        }));

        const analysisPromises = group.keys.map(key => {
            const polishValue = String(getValueByPath(polishFile.data, key) || '');
            const englishValue = String(getValueByPath(englishFile?.data, key) || '');
            const englishTranslation = englishFile ? { lang: englishFile.name, value: englishValue } : null;
            const otherTranslations = props.files
                .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
                .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, key) || '') }));
            
            return analyzeTranslations(
                key, group.context, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations,
                props.translationHistory, referenceTranslations, glossary
            )
            .then(result => ({ key, status: 'fulfilled', value: result }))
            .catch(error => ({ key, status: 'rejected', reason: error as Error }));
        });
        
        const results = await Promise.all(analysisPromises);
        const newAnalysisData: typeof analysisData = {};

        for (const result of results) {
            if (!result) continue;
            if (!newAnalysisData[result.key]) {
                newAnalysisData[result.key] = { result: null, error: null };
            }
            if (result.status === 'fulfilled' && 'value' in result) {
                 newAnalysisData[result.key].result = result.value;
            } else if ('reason' in result) {
                 newAnalysisData[result.key].error = (result.reason as Error).message;
            }
        }
        setAnalysisData(newAnalysisData);
        setIsAnalyzing(false);
    };
    
    const renderGroupForm = () => {
        const displayedKeys = formState.searchQuery ? searchResults : Array.from(formState.selectedKeys).sort();
        
        return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="p-4 border-b border-gray-700 bg-gray-800/50 space-y-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-100">{groupMode === 'create' ? 'Create a New Context Group' : `Editing Group: ${formState.name}`}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Group Name*" value={formState.name} onChange={e => setFormState(s=>({...s, name: e.target.value}))} className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200" />
                    <input type="text" placeholder="Sugestie i uwagi dla tłumacza" value={formState.context} onChange={e => setFormState(s=>({...s, context: e.target.value}))} className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200" />
                </div>
                 <div className="relative">
                    <input type="text" placeholder="Search to add/filter keys..." value={formState.searchQuery} onChange={e => setFormState(s=>({...s, searchQuery: e.target.value}))} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-gray-200"/>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="h-5 w-5 text-gray-400" /></div>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-sm text-left table-fixed">
                    <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr>
                            <th className="p-2 w-12 text-center"><input type="checkbox" className="rounded" onChange={(e) => setFormState(s => ({...s, selectedKeys: e.target.checked ? new Set(searchResults) : new Set()}))} checked={searchResults.length > 0 && formState.selectedKeys.size >= searchResults.length}/></th>
                            <th className="p-2 w-12 text-center">Ref</th>
                            <th className="p-2 w-1/4">Key</th>
                            <th className="p-2 w-1/4">Polish Value</th>
                            <th className="p-2 w-1/4">English Value</th>
                            <th className="p-2 w-1/4">Key Context</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {displayedKeys.map(key => {
                             const plValue = polishFile ? String(getValueByPath(polishFile.data, key) ?? '') : '';
                             const enValue = englishFile ? String(getValueByPath(englishFile.data, key) ?? '') : '';
                            return (
                            <tr key={key} className={`transition-colors ${formState.selectedKeys.has(key) ? 'bg-teal-900/20' : 'hover:bg-gray-800/50'}`}>
                                <td className="p-2 text-center"><input type="checkbox" className="rounded" checked={formState.selectedKeys.has(key)} onChange={() => toggleKeySelection(key)}/></td>
                                <td className="p-2 text-center">
                                    <button onClick={() => toggleReferenceKey(key)} disabled={!formState.selectedKeys.has(key)} className="disabled:opacity-20 disabled:cursor-not-allowed">
                                        <StarIcon className={`w-5 h-5 transition-colors ${formState.referenceKeys.has(key) ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-500'}`} />
                                    </button>
                                </td>
                                <td className="p-2 font-mono text-teal-300 break-words">{key}</td>
                                <td className="p-2">
                                    <EditableValueTextarea
                                        initialValue={plValue}
                                        onSave={(newValue) => polishFile && props.onUpdateValue(polishFile.name, key, newValue)}
                                        fileFound={!!polishFile}
                                        lang="pl"
                                    />
                                </td>
                                <td className="p-2">
                                    <EditableValueTextarea
                                        initialValue={enValue}
                                        onSave={(newValue) => englishFile && props.onUpdateValue(englishFile.name, key, newValue)}
                                        fileFound={!!englishFile}
                                        lang="en"
                                    />
                                </td>
                                <td className="p-2 text-gray-400 italic">
                                     <EditableValueTextarea
                                        initialValue={String(getValueByPath(contexts, key) || '')}
                                        onSave={(newValue) => props.onUpdateContext(key, newValue)}
                                        fileFound={true}
                                        lang="context"
                                     />
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
                 {formState.searchQuery && searchResults.length === 0 && <p className="p-4 text-center text-gray-500">No results found.</p>}
            </div>
             <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-800/50 flex justify-start items-center space-x-4">
                <div className="flex space-x-2">
                    <button onClick={handleSaveGroup} disabled={!formState.name || formState.selectedKeys.size === 0} className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-600">Save Group</button>
                    <button onClick={handleCancelForm} className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-md">Cancel</button>
                </div>
                <p className="text-sm text-gray-400">{formState.selectedKeys.size} key(s) selected, {formState.referenceKeys.size} as reference(s)</p>
            </div>
        </div>
    )};

    const renderViewGroup = (group: TranslationGroup) => (
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
                            Group: <span className="text-teal-400">{group.name}</span> ({group.keys.length} keys)
                        </h2>
                        <div className="flex items-center space-x-2 mt-2">
                            {group.referenceKeys.map(key => (
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
                         <button onClick={() => handleCollapseAll(group)} className="text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-gray-200">Collapse All</button>
                         <button
                            onClick={() => handleCopyAllKeys(group)}
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
                         <button
                            onClick={() => handleShowPrompt(group)}
                            disabled={isAnalyzing}
                            className="p-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors disabled:bg-gray-600"
                            title="Show sample prompt"
                        >
                            <CodeBracketIcon className="w-5 h-5"/>
                        </button>
                        <button 
                            onClick={() => handleAnalyzeGroup(group)}
                            disabled={isAnalyzing}
                            className="flex items-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:bg-gray-600"
                        >
                            <SparklesIcon className="w-5 h-5"/>
                            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Group'}</span>
                        </button>
                    </div>
                </div>
                 <p className="text-sm text-gray-400 bg-gray-900 p-2 rounded-md border border-gray-700">
                   <span className="font-semibold text-gray-300">Context: </span> "{group.context}"
                </p>
            </div>
            <div className="flex-grow overflow-y-auto p-4 lg:p-6 space-y-6 bg-gray-900">
                {group.keys.map(key => {
                    const keyAnalysis = analysisData[key];
                    const referenceTranslations = group.referenceKeys.map(refKey => ({
                        key: refKey,
                        translations: files.map(f => ({ lang: f.name, value: String(getValueByPath(f.data, refKey) || '') }))
                    }));
                    return (
                        <TranslationAnalysisCard
                            key={key}
                            translationKey={key}
                            files={props.files}
                            context={group.context} 
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
                            glossary={glossary}
                        />
                    );
                })}
            </div>
        </div>
    );

    if (groupMode === 'create' || groupMode === 'edit') {
        return renderGroupForm();
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    if (selectedGroup) {
        return renderViewGroup(selectedGroup);
    }

    return (
        <div className="flex items-center justify-center h-full text-center">
            <div>
                <CollectionIcon className="w-16 h-16 mx-auto text-gray-600"/>
                <h2 className="mt-4 text-xl font-semibold text-gray-300">Context Groups</h2>
                <p className="mt-2 text-gray-500">Select a group from the list or create a new one to begin.</p>
            </div>
        </div>
    );
};
