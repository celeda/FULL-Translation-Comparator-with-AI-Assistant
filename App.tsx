
import React, { useState, useMemo, useEffect } from 'react';
import type { TranslationFile, TranslationHistory, TranslationGroup } from './types';
import { flattenObjectKeys, setValueByPath, getValueByPath } from './services/translationService';
import { FileUploader } from './components/FileUploader';
import { TranslationKeyList } from './components/TranslationKeyList';
import { TranslationView } from './components/TranslationView';
import { GroupsView } from './components/GroupsView';
import { BulkTranslateView } from './components/BulkTranslateView';
import { LogoIcon, DownloadIcon, ListBulletIcon, CollectionIcon, PlusCircleIcon, EditIcon, TrashIcon, LanguageIcon, SearchIcon } from './components/Icons';

// Declare JSZip and saveAs for TypeScript since they are loaded from script tags
declare var JSZip: any;
declare var saveAs: any;

type ActiveView = 'keys' | 'groups' | 'bulk';
type GroupMode = 'list' | 'create' | 'edit';

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
  const [translationFiles, setTranslationFiles] = useState<TranslationFile[]>([]);
  const [contexts, setContexts] = useState<Record<string, any>>({});
  const [translationHistory, setTranslationHistory] = useState<TranslationHistory>({});
  const [translationGroups, setTranslationGroups] = useState<TranslationGroup[]>([]);
  const [globalContext, setGlobalContext] = useState<string>('');
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  
  const [activeView, setActiveView] = useState<ActiveView>('keys');

  // State for Groups view
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('list');

  useEffect(() => {
      if (activeView !== 'groups') {
          setGroupMode('list');
      }
  }, [activeView]);

  useEffect(() => {
      if (groupMode === 'list') {
        if (translationGroups.length > 0 && !translationGroups.some(g => g.id === selectedGroupId)) {
            setSelectedGroupId(translationGroups[0].id);
        } else if (translationGroups.length === 0) {
            setSelectedGroupId(null);
        }
      }
  }, [translationGroups, selectedGroupId, groupMode]);

  const handleFilesUpload = (uploadResult: { translationFiles: TranslationFile[], contexts: Record<string, string>, history: TranslationHistory, groups: TranslationGroup[], globalContext: string }) => {
    setTranslationFiles(uploadResult.translationFiles);
    setContexts(uploadResult.contexts);
    setTranslationHistory(uploadResult.history);
    setTranslationGroups(uploadResult.groups);
    setGlobalContext(uploadResult.globalContext);

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

  const handleUpdateValueAndHistory = (fileName: string, key: string, newValue: any) => {
    // Update the main translation file data
    setTranslationFiles(prevFiles => {
      return prevFiles.map(file => {
        if (file.name === fileName) {
          const newData = setValueByPath(file.data, key, newValue);
          return { ...file, data: newData };
        }
        return file;
      });
    });

    // Update the translation history with the user's manual override
    setTranslationHistory(prevHistory => {
      const newHistoryForKey = { ...prevHistory[key], [fileName]: newValue };
      return { ...prevHistory, [key]: newHistoryForKey };
    });
  };

   const handleSaveBulkTranslations = (
    targetLang: string, 
    updatedValues: Record<string, string>
  ) => {
    // Update translation file
    setTranslationFiles(prevFiles =>
      prevFiles.map(file => {
        if (file.name === targetLang) {
          let newData = { ...file.data };
          for (const key in updatedValues) {
            newData = setValueByPath(newData, key, updatedValues[key]);
          }
          return { ...file, data: newData };
        }
        return file;
      })
    );

    // Update history
    setTranslationHistory(prevHistory => {
      const newHistory = { ...prevHistory };
      for (const key in updatedValues) {
        const newHistoryForKey = { ...(newHistory[key] || {}), [targetLang]: updatedValues[key] };
        newHistory[key] = newHistoryForKey;
      }
      return newHistory;
    });
  };


  const handleUpdateContext = (key: string, newContext: string) => {
    setContexts(prevContexts => {
      const currentValue = getValueByPath(prevContexts, key);
      if (currentValue === newContext) {
        return prevContexts;
      }
      const newContexts = setValueByPath(prevContexts, key, newContext);
      return newContexts;
    });
  };

  const handleDownloadFiles = async () => {
    if (translationFiles.length === 0) return;

    try {
      const zip = new JSZip();

      translationFiles.forEach(file => {
        const jsonString = JSON.stringify(file.data, null, 2);
        zip.file(`${file.name}.json`, jsonString);
      });

      if (Object.keys(contexts).length > 0) {
        const contextString = JSON.stringify(contexts, null, 2);
        zip.file('context.json', contextString);
      }
      
      if (Object.keys(translationHistory).length > 0) {
        const historyString = JSON.stringify(translationHistory, null, 2);
        zip.file('history.json', historyString);
      }

      if (translationGroups.length > 0) {
          const groupsString = JSON.stringify(translationGroups, null, 2);
          zip.file('groups.json', groupsString);
      }

      if (globalContext) {
        zip.file('global_context.txt', globalContext);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'translations.zip');

    } catch (error) {
      console.error("Failed to generate or download zip file:", error);
      alert("An error occurred while creating the zip file. Please check the console for details.");
    }
  };

  const handleStartCreatingGroup = () => {
      setGroupMode('create');
      setSelectedGroupId(null);
  };

  const handleStartEditingGroup = (group: TranslationGroup) => {
      setGroupMode('edit');
      setSelectedGroupId(group.id);
  };

  const handleDeleteGroup = (groupId: string) => {
      const updatedGroups = translationGroups.filter(g => g.id !== groupId);
      setTranslationGroups(updatedGroups);
      if (selectedGroupId === groupId) {
          setSelectedGroupId(updatedGroups.length > 0 ? updatedGroups[0].id : null);
      }
  };

  const handleSelectGroup = (groupId: string) => {
      setSelectedGroupId(groupId);
      setGroupMode('list');
  };

  const hasFiles = useMemo(() => translationFiles.length > 0, [translationFiles]);

  const mainContent = () => {
    switch (activeView) {
      case 'keys':
        return selectedKey ? (
          <TranslationView 
              files={translationFiles}
              selectedKey={selectedKey}
              onUpdateValue={handleUpdateValueAndHistory}
              context={getValueByPath(contexts, selectedKey) || ''}
              onUpdateContext={(newContext) => handleUpdateContext(selectedKey, newContext)}
              translationHistory={translationHistory}
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
                files={translationFiles}
                contexts={contexts}
                translationHistory={translationHistory}
                groups={translationGroups}
                onUpdateGroups={setTranslationGroups}
                onUpdateValue={handleUpdateValueAndHistory}
                onUpdateContext={handleUpdateContext}
                groupMode={groupMode}
                selectedGroupId={selectedGroupId}
                onSetGroupMode={setGroupMode}
                onSetSelectedGroupId={setSelectedGroupId}
            />
        );
      case 'bulk':
        return (
            <BulkTranslateView
                allKeys={allKeys}
                files={translationFiles}
                contexts={contexts}
                translationHistory={translationHistory}
                onSave={handleSaveBulkTranslations}
                globalContext={globalContext}
                onUpdateGlobalContext={setGlobalContext}
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


  return (
    <>
      <div className="bg-gray-900 text-gray-200 flex flex-col h-full">
          {!hasFiles ? (
            <main className="flex-grow flex items-center justify-center p-4">
              <div className="max-w-md w-full text-center">
                <div className="flex items-center justify-center space-x-3 mb-6">
                    <LogoIcon className="h-10 w-10 text-teal-400" />
                    <h1 className="text-3xl font-bold text-gray-100">Translation AI Assistant</h1>
                </div>
                <p className="text-gray-400 mb-8">Start by uploading your JSON translation files. You can also include `context.json`, `history.json`, and `groups.json`.</p>
                <FileUploader onFilesUploaded={handleFilesUpload} />
              </div>
            </main>
          ) : (
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
                        className="w-full flex items-center justify-center space-x-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span>Download ZIP</span>
                    </button>
                </div>
                <div className="flex border-b border-gray-700 flex-shrink-0">
                    <button
                        onClick={() => setActiveView('keys')}
                        title="View by Key"
                        className={`flex-1 flex items-center justify-center space-x-2 p-3 text-sm font-medium transition-colors ${activeView === 'keys' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        <ListBulletIcon className="w-5 h-5" />
                        <span>Keys</span>
                    </button>
                     <button
                        onClick={() => setActiveView('groups')}
                        title="View by Group"
                        className={`flex-1 flex items-center justify-center space-x-2 p-3 text-sm font-medium transition-colors ${activeView === 'groups' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        <CollectionIcon className="w-5 h-5" />
                        <span>Groups</span>
                    </button>
                    <button
                        onClick={() => setActiveView('bulk')}
                        title="Bulk Translate"
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
                    translationFiles={translationFiles}
                  />
                ) : activeView === 'groups' ? (
                  <GroupListPanel
                    groups={translationGroups}
                    selectedGroupId={selectedGroupId}
                    onSelectGroup={handleSelectGroup}
                    onStartCreating={handleStartCreatingGroup}
                    onStartEditing={handleStartEditingGroup}
                    onDeleteGroup={handleDeleteGroup}
                  />
                ) : null}
              </aside>
              <main className="flex-1 overflow-hidden">
                {mainContent()}
              </main>
            </div>
          )}
      </div>
    </>
  );
};

export default App;
