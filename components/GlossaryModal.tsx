
import React, { useState, useEffect } from 'react';
import type { Glossary } from '../types';
import { BookOpenIcon, CloseIcon, CheckIcon, EditIcon, TrashIcon, PlusCircleIcon, DownloadIcon, UploadIcon } from './Icons';

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  glossary: Glossary;
  onUpdateGlossary: (glossary: Glossary) => void;
  languages: string[];
}

declare var saveAs: any;

export const GlossaryModal: React.FC<GlossaryModalProps> = ({ isOpen, onClose, glossary, onUpdateGlossary, languages }) => {
  const [newSourceTerm, setNewSourceTerm] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // State for editing a specific language translation of a source term
  const [editingEntry, setEditingEntry] = useState<{ source: string; lang: string } | null>(null);
  const [editedValue, setEditedValue] = useState('');

  // State for adding a new language translation to an existing source term
  const [addingToSource, setAddingToSource] = useState<string | null>(null);
  const [newLang, setNewLang] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewSourceTerm('');
      setAddError(null);
      setImportError(null);
      setEditingEntry(null);
      setAddingToSource(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddSourceTerm = () => {
    const term = newSourceTerm.trim();
    if (!term) {
      setAddError('Source term cannot be empty.');
      return;
    }
    if (glossary.hasOwnProperty(term)) {
      setAddError('This source term already exists.');
      return;
    }
    setAddError(null);
    onUpdateGlossary({ ...glossary, [term]: {} });
    setNewSourceTerm('');
  };

  const handleDeleteSourceTerm = (source: string) => {
    const { [source]: _, ...rest } = glossary;
    onUpdateGlossary(rest);
  };

  const handleStartEdit = (source: string, lang: string, value: string) => {
    setEditingEntry({ source, lang });
    setEditedValue(value);
    setAddingToSource(null); // Close add form if open
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    const { source, lang } = editingEntry;
    const updatedGlossary = {
      ...glossary,
      [source]: {
        ...glossary[source],
        [lang]: editedValue.trim(),
      },
    };
    onUpdateGlossary(updatedGlossary);
    setEditingEntry(null);
  };
  
  const handleStartAddTranslation = (source: string) => {
    setAddingToSource(source);
    setNewLang(languages.find(l => !glossary[source].hasOwnProperty(l)) || languages[0] || '');
    setNewValue('');
    setEditingEntry(null); // Close edit form if open
  };
  
  const handleAddTranslation = () => {
    if (!addingToSource || !newLang) return;
    const updatedGlossary = {
        ...glossary,
        [addingToSource]: {
            ...glossary[addingToSource],
            [newLang]: newValue.trim(),
        },
    };
    onUpdateGlossary(updatedGlossary);
    setAddingToSource(null);
  };

  const handleDeleteTranslation = (source: string, lang: string) => {
    const { [lang]: _, ...rest } = glossary[source];
    onUpdateGlossary({ ...glossary, [source]: rest });
  };


  const handleExport = () => {
    const glossaryString = JSON.stringify(glossary, null, 2);
    const blob = new Blob([glossaryString], { type: 'application/json;charset=utf-8' });
    saveAs(blob, 'glossary.json');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
           throw new Error("Invalid JSON: must be a single object.");
        }
        
        onUpdateGlossary(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setImportError(`Error parsing file: ${message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <BookOpenIcon className="w-6 h-6 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">Multi-language Glossary</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto flex-grow space-y-6">
            {Object.keys(glossary).length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                    <p>Your glossary is empty.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(glossary).map(([source, translations]) => (
                        <div key={source} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-lg text-teal-300 font-mono">{source}</h3>
                                <div className="flex items-center space-x-2">
                                     <button onClick={() => handleStartAddTranslation(source)} className="p-1.5 rounded-md bg-teal-600/50 hover:bg-teal-600 text-white transition-colors" title="Add translation">
                                        <PlusCircleIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteSourceTerm(source)} className="p-1.5 rounded-md bg-gray-700/80 hover:bg-red-600/50 text-gray-300 hover:text-red-300 transition-colors" title="Delete source term">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {addingToSource === source && (
                                <div className="grid grid-cols-3 gap-2 p-2 my-2 bg-gray-700/50 rounded-md">
                                    <select value={newLang} onChange={e => setNewLang(e.target.value)} className="bg-gray-800 border-gray-600 rounded-md py-1 px-2 text-sm">
                                      {languages
                                        .filter(l => !translations.hasOwnProperty(l))
                                        .map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                    <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Translation" className="bg-gray-800 border-gray-600 rounded-md py-1 px-2 col-span-2 text-sm" />
                                     <div className="col-span-3 flex justify-end space-x-2 mt-1">
                                        <button onClick={() => setAddingToSource(null)} className="text-xs px-2 py-1 bg-gray-600 rounded">Cancel</button>
                                        <button onClick={handleAddTranslation} className="text-xs px-2 py-1 bg-teal-600 rounded">Add</button>
                                    </div>
                                </div>
                            )}

                            <table className="w-full text-sm">
                                <tbody>
                                    {Object.entries(translations).map(([lang, value]) => (
                                        <tr key={lang} className="border-b border-gray-700/50 last:border-0">
                                            <td className="p-2 w-24 font-semibold text-gray-400">{lang}</td>
                                            {editingEntry?.source === source && editingEntry?.lang === lang ? (
                                                <>
                                                    <td className="p-2">
                                                        <input type="text" value={editedValue} onChange={e => setEditedValue(e.target.value)} className="w-full bg-gray-800 border-gray-600 rounded-md py-1 px-2" />
                                                    </td>
                                                    <td className="p-2 w-24 text-right">
                                                        <div className="flex space-x-2 justify-end">
                                                            <button onClick={handleSaveEdit} className="p-1.5 bg-teal-600 rounded"><CheckIcon className="w-4 h-4" /></button>
                                                            <button onClick={() => setEditingEntry(null)} className="p-1.5 bg-gray-600 rounded"><CloseIcon className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2 text-gray-300">{value}</td>
                                                    <td className="p-2 w-24 text-right">
                                                        <div className="flex space-x-2 justify-end">
                                                            <button onClick={() => handleStartEdit(source, lang, value)} className="p-1.5 bg-gray-700/80 rounded"><EditIcon className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDeleteTranslation(source, lang)} className="p-1.5 bg-gray-700/80 rounded hover:bg-red-600/50"><TrashIcon className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <footer className="p-4 border-t border-gray-700 bg-gray-800/50 flex-shrink-0 space-y-4">
            <div>
              <h3 className="text-md font-semibold text-gray-200 mb-3">Add New Source Term</h3>
              <div className="flex gap-4">
                  <input 
                      type="text"
                      placeholder="New Source Term (e.g., in Polish)"
                      value={newSourceTerm}
                      onChange={(e) => { setNewSourceTerm(e.target.value); setAddError(null); }}
                      className="flex-grow bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200"
                  />
                  <button onClick={handleAddSourceTerm} className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-md">
                      <PlusCircleIcon className="w-5 h-5"/>
                      <span>Add Term</span>
                  </button>
              </div>
              {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
            </div>
            
            <div className="border-t border-gray-700 !mt-4 !mb-0"></div>

            <div>
              <h3 className="text-md font-semibold text-gray-200 mb-3">Manage File</h3>
               <div className="grid grid-cols-2 gap-2">
                  <label htmlFor="import-glossary" className="w-full flex items-center justify-center space-x-2 cursor-pointer text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-md">
                      <UploadIcon className="w-5 h-5" />
                      <span>Import & Overwrite</span>
                  </label>
                  <input id="import-glossary" type="file" className="hidden" onChange={handleImport} accept=".json" />
                  <button onClick={handleExport} className="w-full flex items-center justify-center space-x-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-md">
                      <DownloadIcon className="w-5 h-5" />
                      <span>Export</span>
                  </button>
               </div>
               {importError && <p className="text-red-400 text-xs mt-2 text-center">{importError}</p>}
            </div>
        </footer>
      </div>
    </div>
  );
};