import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory, TranslationGroup } from './types';
import { flattenObjectKeys, setValueByPath, getValueByPath } from './services/translationService';
import { FileUploader } from './components/FileUploader';
import { TranslationKeyList } from './components/TranslationKeyList';
import { TranslationView } from './components/TranslationView';
import { GroupsView } from './components/GroupsView';
import { BulkTranslateView } from './components/BulkTranslateView';
import { LogoIcon, DownloadIcon, ListBulletIcon, CollectionIcon, PlusCircleIcon, EditIcon, TrashIcon, LanguageIcon, SearchIcon, BookOpenIcon, UploadIcon } from './components/Icons';

// Declare JSZip and saveAs for TypeScript since they are loaded from script tags
declare var JSZip: any;
declare var saveAs: any;

type ActiveView = 'keys' | 'groups' | 'bulk';
type GroupMode = 'list' | 'create' | 'edit';

interface ProjectData {
    translationFiles: TranslationFile[];
    contexts: Record<string, any>;
    translationHistory: TranslationHistory;
    translationGroups: TranslationGroup[];
    globalContext: string;
    lastUpdated: string;
}

// Component for the sidebar when 'Groups' view is active
interface GroupListPanelProps {
    groups: TranslationGroup[];
    selectedGroupId: string | null;
    onSelectGroup: (groupId: string) => void;
    onStartCreating: () => void;
    onStartEditing: (group: TranslationGroup) => void;
    onDeleteGroup: (groupId: string) => void;
}

const GroupListPanel: React.FC<GroupListPanelProps> = ({
    groups,
    selectedGroupId,
    onSelectGroup,
    onStartCreating,
    onStartEditing,
    onDeleteGroup,
}) => {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-700">
                <button
                    onClick={onStartCreating}
                    className="w-full flex items-center justify-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    <span>Create New Group</span>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {groups.length > 0 ? (
                    <ul>
                        {groups.map(group => (
                            <li key={group.id}>
                                <button
                                    onClick={() => onSelectGroup(group.id)}
                                    className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 group flex justify-between items-center ${
                                        selectedGroupId === group.id
                                        ? 'bg-teal-500/20 text-teal-300 font-semibold'
                                        : 'text-gray-300 hover:bg-gray-700/50'
                                    }`}
                                >
                                    <span className="truncate pr-2">{group.name}</span>
                                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                        <span className="text-xs bg-gray-700 rounded-full px-2 py-0.5 opacity-100 group-hover:opacity-0">{group.keys.length}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onStartEditing(group); }}
                                            className="p-1 rounded-md text-gray-400 hover:text-teal-400"
                                            title="Edit group"
                                        >
                                          <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
                                            className="p-1 rounded-md text-gray-400 hover:text-red-400"
                                            title="Delete group"
                                        >
                                          <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-4 text-center text-gray-500 text-sm mt-4">No groups created yet.</div>
                )}
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [initialDataFromStorage, setInitialDataFromStorage] = useState<ProjectData | null>(null);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);

  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('keys');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('list');
  
  // Load from localStorage on initial mount
  useEffect(() => {
    try {
        const savedData = localStorage.getItem('translationAppState');
        if (savedData) {
            setInitialDataFromStorage(JSON.parse(savedData));
        }
    } catch (error) {
        console.error("Failed to load project from local storage:", error);
        localStorage.removeItem('translationAppState');
    }
    setIsCheckingStorage(false);
  }, []);

  // Save to localStorage whenever projectData changes
  useEffect(() => {
    if (projectData) {
        try {
            localStorage.setItem('translationAppState', JSON.stringify(projectData));
        } catch (error) {
            console.error("Failed to save project to local storage:", error);
        }
    }
  }, [projectData]);
  
  useEffect(() => {
      if (activeView !== 'groups') {
          setGroupMode('list');
      }
  }, [activeView]);

  useEffect(() => {
      if (groupMode === 'list' && projectData) {
        if (projectData.translationGroups.length > 0 && !projectData.translationGroups.some(g => g.id === selectedGroupId)) {
            setSelectedGroupId(projectData.translationGroups[0].id);
        } else if (projectData.translationGroups.length === 0) {
            setSelectedGroupId(null);
        }
      }
  }, [projectData?.translationGroups, selectedGroupId, groupMode]);

  const updateProjectData = (updater: (prev: ProjectData) => Omit<Partial<ProjectData>, 'lastUpdated'>) => {
    setProjectData(prev => {
        if (!prev) return null;
        const updates = updater(prev);
        return { ...prev, ...updates, lastUpdated: new Date().toISOString() };
    });
  };

  const handleFilesUpload = (uploadResult: { 
      translationFiles: TranslationFile[], 
      contexts: Record<string, string>, 
      history: TranslationHistory, 
      groups: TranslationGroup[],
      globalContext: string 
  }) => {
    const newProjectData: ProjectData = {
        translationFiles: uploadResult.translationFiles,
        contexts: uploadResult.contexts,
        translationHistory: uploadResult.history,
        translationGroups: uploadResult.groups,
        globalContext: uploadResult.globalContext,
        lastUpdated: new Date().toISOString()
    };
    setProjectData(newProjectData);

    if (uploadResult.groups.length > 0) {
        setSelectedGroupId(uploadResult.groups[0].id);
    } else {
        setSelectedGroupId(null);
    }
    setGroupMode('list');

    const uploadedFiles = uploadResult.translationFiles;
    if (uploadedFiles.length > 0) {
      const allKeysSet = new Set<string>();
      uploadedFiles.forEach(file => {
        flattenObjectKeys(file.data).forEach(key => allKeysSet.add(key));
      });
      const sortedKeys = Array.from(allKeysSet).sort();
      setAllKeys(sortedKeys);
      setSelectedKey(sortedKeys[0] || null);
      setActiveView('keys');
    } else {
      setAllKeys([]);
      setSelectedKey(null);
    }
  };
  
  const handleContinueSession = () => {
    if (initialDataFromStorage) {
        setProjectData(initialDataFromStorage);
        // Recalculate allKeys and set initial selected key
        const allKeysSet = new Set<string>();
        initialDataFromStorage.translationFiles.forEach(file => {
            flattenObjectKeys(file.data).forEach(key => allKeysSet.add(key));
        });
        const sortedKeys = Array.from(allKeysSet).sort();
        setAllKeys(sortedKeys);
        setSelectedKey(sortedKeys[0] || null);

        if (initialDataFromStorage.translationGroups.length > 0) {
            setSelectedGroupId(initialDataFromStorage.translationGroups[0].id);
        }
    }
  };

  const handleStartNewProject = () => {
    if (window.confirm("Starting a new project will clear your currently saved session. Are you sure you want to continue?")) {
        localStorage.removeItem('translationAppState');
        setProjectData(null);
        setInitialDataFromStorage(null);
    }
  };

  const handleUpdateValueAndHistory = (fileName: string, key: string, newValue: any) => {
    updateProjectData(prev => {
        const newFiles = prev.translationFiles.map(file => {
            if (file.name === fileName) {
                const newData = setValueByPath(file.data, key, newValue);
                return { ...file, data: newData };
            }
            return file;
        });
        const newHistoryForKey = { ...prev.translationHistory[key], [fileName]: newValue };
        const newHistory = { ...prev.translationHistory, [key]: newHistoryForKey };
        return { translationFiles: newFiles, translationHistory: newHistory };
    });
  };

  const handleSaveBulkTranslations = (updatedValuesByLang: Record<string, Record<string, string>>) => {
    updateProjectData(prev => {
        const newHistory = { ...prev.translationHistory };
        const langFileMap = new Map(prev.translationFiles.map(f => [f.name, { ...f.data }]));

        for (const lang in updatedValuesByLang) {
            if (langFileMap.has(lang)) {
                const updatedValues = updatedValuesByLang[lang];
                let currentLangData = langFileMap.get(lang)!;
                
                for (const key in updatedValues) {
                    const newValue = updatedValues[key];
                    currentLangData = setValueByPath(currentLangData, key, newValue);
                    
                    // Update history as well
                    const newHistoryForKey = { ...(newHistory[key] || {}), [lang]: newValue };
                    newHistory[key] = newHistoryForKey;
                }
                langFileMap.set(lang, currentLangData);
            }
        }

        const newFiles = prev.translationFiles.map(file => {
            if (langFileMap.has(file.name)) {
                return { ...file, data: langFileMap.get(file.name)! };
            }
            return file;
        });
        
        return { translationFiles: newFiles, translationHistory: newHistory };
    });
  };

  const handleUpdateContext = (key: string, newContext: string) => {
    updateProjectData(prev => {
        const currentValue = getValueByPath(prev.contexts, key);
        if (currentValue === newContext) return {}; // No change
        const newContexts = setValueByPath(prev.contexts, key, newContext);
        return { contexts: newContexts };
    });
  };

  const handleDownloadFiles = async () => {
    if (!projectData) return;

    try {
      const zip = new JSZip();

      projectData.translationFiles.forEach(file => {
        const jsonString = JSON.stringify(file.data, null, 2);
        zip.file(`${file.name}.json`, jsonString);
      });

      if (Object.keys(projectData.contexts).length > 0) zip.file('context.json', JSON.stringify(projectData.contexts, null, 2));
      if (Object.keys(projectData.translationHistory).length > 0) zip.file('history.json', JSON.stringify(projectData.translationHistory, null, 2));
      if (projectData.translationGroups.length > 0) zip.file('groups.json', JSON.stringify(projectData.translationGroups, null, 2));
      if (projectData.globalContext) zip.file('global_context.txt', projectData.globalContext);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'translations.zip');

    } catch (error) {
      console.error("Failed to generate or download zip file:", error);
      alert("An error occurred while creating the zip file. Please check the console for details.");
    }
  };

  const mainContent = (pData: ProjectData) => {
    switch (activeView) {
      case 'keys':
        return selectedKey ? (
          <TranslationView 
              files={pData.translationFiles}
              selectedKey={selectedKey}
              onUpdateValue={handleUpdateValueAndHistory}
              context={getValueByPath(pData.contexts, selectedKey) || ''}
              onUpdateContext={(newContext) => handleUpdateContext(selectedKey, newContext)}
              translationHistory={pData.translationHistory}
              globalContext={pData.globalContext}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-800/30 rounded-lg m-8">
            <p className="text-gray-500">Select a key from the left to see translations.</p>
          </div>
        );
      case 'groups':
        return (
           <GroupsView
                allKeys={allKeys}
                files={pData.translationFiles}
                contexts={pData.contexts}
                translationHistory={pData.translationHistory}
                groups={pData.translationGroups}
                onUpdateGroups={(newGroups) => updateProjectData(() => ({ translationGroups: newGroups }))}
                onUpdateValue={handleUpdateValueAndHistory}
                onUpdateContext={handleUpdateContext}
                groupMode={groupMode}
                selectedGroupId={selectedGroupId}
                onSetGroupMode={setGroupMode}
                onSetSelectedGroupId={setSelectedGroupId}
                globalContext={pData.globalContext}
            />
        );
      case 'bulk':
        return (
            <BulkTranslateView
                allKeys={allKeys}
                files={pData.translationFiles}
                contexts={pData.contexts}
                translationHistory={pData.translationHistory}
                onSave={handleSaveBulkTranslations}
                globalContext={pData.globalContext}
                onUpdateGlobalContext={(newContext) => updateProjectData(() => ({ globalContext: newContext }))}
                onUpdateContext={handleUpdateContext}
            />
        );
      default:
        return (
            <div className="flex items-center justify-center h-full bg-gray-800/30 rounded-lg m-8">
                <p className="text-gray-500">Select a view from the left panel.</p>
            </div>
        );
    }
  };

  if (isCheckingStorage) {
      return <div className="flex items-center justify-center h-full text-gray-400">Loading Session...</div>;
  }

  return (
    <div className="bg-gray-900 text-gray-200 flex flex-col h-full">
        {!projectData ? (
            <main className="flex-grow flex items-center justify-center p-4">
                <div className="max-w-xl w-full text-center">
                    <div className="flex items-center justify-center space-x-3 mb-6">
                        <LogoIcon className="h-10 w-10 text-teal-400" />
                        <h1 className="text-3xl font-bold text-gray-100">Translation AI Assistant</h1>
                    </div>
                    {initialDataFromStorage ? (
                        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                             <p className="text-gray-300 mb-2">A saved session was found.</p>
                             <p className="text-xs text-gray-500 mb-4">Last updated: {new Date(initialDataFromStorage.lastUpdated).toLocaleString()}</p>
                             <button onClick={handleContinueSession} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md mb-4">
                                Continue Session
                             </button>
                             <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-600" /></div>
                                <div className="relative flex justify-center"><span className="bg-gray-800/50 px-2 text-sm text-gray-500">or</span></div>
                             </div>
                             <button onClick={handleStartNewProject} className="w-full flex items-center justify-center space-x-2 text-sm bg-indigo-600/80 hover:bg-indigo-600/90 text-white font-medium py-2 px-4 rounded-md">
                                <UploadIcon className="w-5 h-5"/>
                                <span>Import New Project</span>
                             </button>
                             <p className="text-xs text-gray-500 mt-2">This will clear your saved session.</p>
                        </div>
                    ) : (
                        <div>
                           <p className="text-gray-400 mb-8">Start by uploading your JSON translation files. You can also include `context.json`, `history.json`, and `groups.json`.</p>
                           <FileUploader onFilesUploaded={handleFilesUpload} />
                        </div>
                    )}
                </div>
            </main>
        ) : (
            <>
                <div className="flex h-full w-full">
                <aside className="w-96 flex-shrink-0 bg-gray-800/50 border-r border-gray-700 flex flex-col h-full">
                    <div className="p-4 border-b border-gray-700 flex-shrink-0 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <LogoIcon className="h-8 w-8 text-teal-400" />
                            <h1 className="text-xl font-bold text-gray-100 truncate">Translation AI</h1>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-700 flex-shrink-0">
                        <button
                            onClick={handleDownloadFiles}
                            className="w-full flex items-center justify-center space-x-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span>Download Project</span>
                        </button>
                    </div>
                    <div className="flex border-b border-gray-700 flex-shrink-0">
                        <button
                            onClick={() => setActiveView('keys')} title="View by Key"
                            className={`flex-1 flex items-center justify-center space-x-2 p-3 text-sm font-medium transition-colors ${activeView === 'keys' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            <ListBulletIcon className="w-5 h-5" />
                            <span>Keys</span>
                        </button>
                        <button
                            onClick={() => setActiveView('groups')} title="View by Group"
                            className={`flex-1 flex items-center justify-center space-x-2 p-3 text-sm font-medium transition-colors ${activeView === 'groups' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            <CollectionIcon className="w-5 h-5" />
                            <span>Groups</span>
                        </button>
                        <button
                            onClick={() => setActiveView('bulk')} title="Bulk Translate"
                            className={`flex-1 flex items-center justify-center space-x-2 p-3 text-sm font-medium transition-colors ${activeView === 'bulk' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            <LanguageIcon className="w-5 h-5" />
                            <span>Bulk</span>
                        </button>
                    </div>

                    {activeView === 'keys' ? (
                    <TranslationKeyList 
                        keys={allKeys} 
                        onSelectKey={setSelectedKey}
                        selectedKey={selectedKey}
                        translationFiles={projectData.translationFiles}
                    />
                    ) : activeView === 'groups' ? (
                    <GroupListPanel
                        groups={projectData.translationGroups}
                        selectedGroupId={selectedGroupId}
                        onSelectGroup={(id) => { setSelectedGroupId(id); setGroupMode('list'); }}
                        onStartCreating={() => { setGroupMode('create'); setSelectedGroupId(null); }}
                        onStartEditing={(group) => { setGroupMode('edit'); setSelectedGroupId(group.id); }}
                        onDeleteGroup={(id) => {
                            const updated = projectData.translationGroups.filter(g => g.id !== id);
                            updateProjectData(() => ({ translationGroups: updated }));
                            if (selectedGroupId === id) setSelectedGroupId(updated.length > 0 ? updated[0].id : null);
                        }}
                    />
                    ) : null}
                </aside>
                <main className="flex-1 overflow-hidden">
                    {mainContent(projectData)}
                </main>
                </div>
            </>
        )}
    </div>
  );
};

export default App;
