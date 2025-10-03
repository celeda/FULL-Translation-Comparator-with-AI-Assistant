import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationGroup } from '../types';
import { getValueByPath } from '../services/translationService';
import { SearchIcon, StarIcon } from './Icons';
import { EditableTextarea } from './EditableTextarea';

interface GroupEditorFormProps {
    allKeys: string[];
    files: TranslationFile[];
    contexts: Record<string, any>;
    onUpdateValue: (fileName: string, key: string, newValue: any) => void;
    onUpdateContext: (key: string, newContext: string) => void;
    onSave: (groupData: Omit<TranslationGroup, 'id'>) => void;
    onCancel: () => void;
    initialData?: TranslationGroup;
    mode: 'create' | 'edit';
}


export const GroupEditorForm: React.FC<GroupEditorFormProps> = ({
    allKeys, files, contexts, onUpdateValue, onUpdateContext, onSave, onCancel, initialData, mode
}) => {
    const [formState, setFormState] = useState({
        name: initialData?.name || '',
        context: initialData?.context || '',
        searchQuery: '',
        selectedKeys: new Set<string>(initialData?.keys || []),
        referenceKeys: new Set<string>(initialData?.referenceKeys || []),
    });

    const polishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish')), [files]);
    const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);

    const handleSave = () => {
        const { name, context, selectedKeys, referenceKeys } = formState;
        if (!name.trim() || selectedKeys.size === 0) {
            alert("Group name and at least one selected key are required.");
            return;
        }
        onSave({
            name: name.trim(),
            context: context.trim(),
            keys: Array.from(selectedKeys),
            referenceKeys: Array.from(referenceKeys),
        });
    };

    const searchResults = useMemo(() => {
        const query = formState.searchQuery.trim();
        if (!query) return mode === 'edit' ? Array.from(formState.selectedKeys).sort() : [];

        const lowercasedQuery = query.toLowerCase();
        
        return allKeys.filter(key => {
            if (mode === 'edit' && formState.selectedKeys.has(key)) return true;

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
    }, [formState.searchQuery, formState.selectedKeys, allKeys, polishFile, mode]);

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

    const displayedKeys = formState.searchQuery ? searchResults : Array.from(formState.selectedKeys).sort();

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="p-4 border-b border-gray-700 bg-gray-800/50 space-y-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-100">{mode === 'create' ? 'Create a New Context Group' : `Editing Group: ${initialData?.name}`}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Group Name*" value={formState.name} onChange={e => setFormState(s=>({...s, name: e.target.value}))} className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200" />
                    <input type="text" placeholder="Group context for AI" value={formState.context} onChange={e => setFormState(s=>({...s, context: e.target.value}))} className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200" />
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
                                    <EditableTextarea
                                        initialValue={plValue}
                                        onSave={(newValue) => polishFile && onUpdateValue(polishFile.name, key, newValue)}
                                        disabled={!polishFile}
                                        placeholder={!polishFile ? "pl file not found" : ""}
                                    />
                                </td>
                                <td className="p-2">
                                    <EditableTextarea
                                        initialValue={enValue}
                                        onSave={(newValue) => englishFile && onUpdateValue(englishFile.name, key, newValue)}
                                        disabled={!englishFile}
                                        placeholder={!englishFile ? "en file not found" : ""}
                                    />
                                </td>
                                <td className="p-2 text-gray-400 italic">
                                     <EditableTextarea
                                        initialValue={String(getValueByPath(contexts, key) || '')}
                                        onSave={(newValue) => onUpdateContext(key, newValue)}
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
                    <button onClick={handleSave} disabled={!formState.name || formState.selectedKeys.size === 0} className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-600">Save Group</button>
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-md">Cancel</button>
                </div>
                <p className="text-sm text-gray-400">{formState.selectedKeys.size} key(s) selected, {formState.referenceKeys.size} as reference(s)</p>
            </div>
        </div>
    );
};