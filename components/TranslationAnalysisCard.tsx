import React, { useState, useEffect, useMemo } from 'react';
import type { TranslationFile, AIAnalysisResult, TranslationHistory } from '../types';
import { getValueByPath, getLineNumber } from '../services/translationService';
import { analyzeTranslations, generateContextForKey, buildAnalysisPrompt, buildGenerateContextPrompt } from '../services/aiService';
import { CheckIcon, EditIcon, ClipboardIcon, SparklesIcon, PanelOpenIcon, PanelCloseIcon, BoltIcon, LightBulbIcon, CodeBracketIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import { JsonFileViewer } from './JsonFileViewer';
import { PromptViewerModal } from './PromptViewerModal';
import { AnalysisResultDisplay } from './AnalysisResultDisplay';


interface TranslationAnalysisCardProps {
  files: TranslationFile[];
  translationKey: string;
  onUpdateValue: (fileName: string, key: string, newValue: any) => void;
  context: string;
  onUpdateContext: (newContext: string) => void;
  translationHistory: TranslationHistory;
  showFilePreview?: boolean;
  analysisResult?: AIAnalysisResult | null;
  isLoading?: boolean;
  error?: string | null;
  showAnalysisControls?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (key: string) => void;
  groupReferenceTranslations?: { key: string; translations: { lang: string; value: string }[] }[];
  globalContext?: string;
}

interface ValueDisplayProps {
  value: any;
  onSave: (newValue: any) => void;
}

const ValueDisplay: React.FC<ValueDisplayProps> = ({ value, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedValue, setEditedValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isObjectOrArray = typeof value === 'object' && value !== null;

    const handleEditClick = () => {
        const initialValue = value === undefined || value === null ? '' : value;
        setEditedValue(isObjectOrArray ? JSON.stringify(initialValue, null, 2) : String(initialValue));
        setIsEditing(true);
        setError(null);
    };

    const handleCancelClick = () => {
        setIsEditing(false);
        setError(null);
    };

    const handleSaveClick = () => {
        let newValue;
        if (isObjectOrArray) {
            try {
                newValue = JSON.parse(editedValue);
                setError(null);
            } catch (e) {
                setError('Invalid JSON format.');
                return;
            }
        } else if (typeof value === 'number') {
            newValue = parseFloat(editedValue);
            if (isNaN(newValue)) {
                setError('Invalid number format.');
                return;
            }
        } else if (typeof value === 'boolean') {
            if (editedValue.toLowerCase() === 'true') {
                newValue = true;
            } else if (editedValue.toLowerCase() === 'false') {
                newValue = false;
            } else {
                setError('Must be "true" or "false".');
                return;
            }
        } else {
             newValue = editedValue;
        }

        onSave(newValue);
        setIsEditing(false);
    };

    let displayValue: React.ReactNode;
    
    if (value === undefined) {
        displayValue = <span className="text-gray-500 italic">Not found</span>;
    } else if (value === null) {
        displayValue = <span className="text-purple-400">null</span>;
    } else if (isObjectOrArray) {
        displayValue = <pre className="text-sm whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>;
    } else if (typeof value === 'string') {
        displayValue = <p className="text-base text-green-300 whitespace-pre-wrap break-words">"{value}"</p>;
    } else if (typeof value === 'number') {
        displayValue = <p className="text-base text-blue-300">{value}</p>;
    } else if (typeof value === 'boolean') {
        displayValue = <p className="text-base text-purple-400">{String(value)}</p>;
    } else {
        displayValue = <p className="text-base">{String(value)}</p>;
    }

    if (isEditing) {
        const InputComponent = isObjectOrArray || (typeof value === 'string' && value.length > 60) ? 'textarea' : 'input';
        const rows = isObjectOrArray ? Math.max(8, editedValue.split('\n').length) : 3;
        return (
            <div className="flex-1 min-w-0 p-3 space-y-2 bg-gray-900/50 rounded-md">
                <InputComponent
                    value={editedValue}
                    onChange={(e) => setEditedValue(e.target.value)}
                    rows={rows}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-gray-200 font-mono text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    autoFocus
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex justify-end space-x-2">
                    <button onClick={handleCancelClick} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-1 px-2 rounded-md transition-colors duration-200">
                        Cancel
                    </button>
                    <button onClick={handleSaveClick} className="text-xs bg-teal-600 hover:bg-teal-500 text-white font-medium py-1 px-2 rounded-md transition-colors duration-200">
                        Save
                    </button>
                </div>
            </div>
        )
    }
    
    return (
        <div className="flex-1 min-w-0 relative group">
            <div className="absolute top-1 right-1 flex space-x-1">
                 {value !== undefined && (
                    <button
                        onClick={handleEditClick}
                        className="p-1 rounded-md bg-gray-700/50 hover:bg-gray-600 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Edit value"
                    >
                        <EditIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="flex items-start">
                 <div className="flex-1 min-w-0">{displayValue}</div>
            </div>
        </div>
    );
};

const StatusBadge: React.FC<{ type: 'Good' | 'Needs Improvement' | 'Incorrect'; count: number }> = ({ type, count }) => {
    if (count === 0) return null;
    const styles = {
        'Good': "bg-green-900 text-green-300",
        'Needs Improvement': "bg-yellow-900 text-yellow-300",
        'Incorrect': "bg-red-900 text-red-300",
    };
    const text = {
        'Good': 'Good',
        'Needs Improvement': 'Needs Fix',
        'Incorrect': 'Incorrect'
    }
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[type]}`}>{text[type]}: {count}</span>;
};


export const TranslationAnalysisCard: React.FC<TranslationAnalysisCardProps> = (props) => {
  const { 
      files, translationKey, onUpdateValue, context: parentContext, onUpdateContext, 
      translationHistory, showFilePreview = false,
      analysisResult: analysisResultProp,
      isLoading: isLoadingProp,
      error: errorProp,
      showAnalysisControls = true,
      isCollapsed = false,
      onToggleCollapse,
      groupReferenceTranslations,
      globalContext,
  } = props;
  
  const [previewFileIndex, setPreviewFileIndex] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [copiedKeyName, setCopiedKeyName] = useState(false);
  const [copiedKeyValues, setCopiedKeyValues] = useState(false);
  const [localContext, setLocalContext] = useState('');
  const [recentlyApplied, setRecentlyApplied] = useState<Set<string>>(new Set());

  // Internal state for when the card manages its own analysis lifecycle
  const [internalAnalysisResult, setInternalAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  
  // A local copy of the analysis result to allow for optimistic UI updates (e.g., "Applied" status)
  const [displayAnalysisResult, setDisplayAnalysisResult] = useState<AIAnalysisResult | null | undefined>(analysisResultProp);

  useEffect(() => {
    setDisplayAnalysisResult(analysisResultProp);
  }, [analysisResultProp]);

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // Determine which state source to use
  const analysisResult = showAnalysisControls ? internalAnalysisResult : displayAnalysisResult;
  const isLoading = showAnalysisControls ? internalIsLoading : isLoadingProp;
  const error = showAnalysisControls ? internalError : errorProp;

  const polishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish')), [files]);
  const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);

  useEffect(() => {
    if (previewFileIndex >= files.length && files.length > 0) {
        setPreviewFileIndex(0);
    }
  }, [files, previewFileIndex]);

  useEffect(() => {
      setInternalAnalysisResult(null);
      setInternalError(null);
      setLocalContext(parentContext || '');
      setRecentlyApplied(new Set());
  }, [translationKey, parentContext]);
  
  const unappliedSuggestions = useMemo(() => {
    if (!analysisResult?.analysis) return [];
    
    return analysisResult.analysis.filter(item => {
        if (!item.suggestion?.trim()) return false;
        const file = files.find(f => f.name === item.language);
        if (!file) return false;
        const currentValue = getValueByPath(file.data, translationKey);
        return currentValue !== item.suggestion;
    });
  }, [analysisResult, files, translationKey]);

   const statusSummary = useMemo(() => {
    if (!analysisResult?.analysis) return null;
    const counts = analysisResult.analysis.reduce((acc, item) => {
        acc[item.evaluation] = (acc[item.evaluation] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    return counts;
  }, [analysisResult]);


  const handleContextBlur = () => {
    if (localContext !== parentContext) {
        onUpdateContext(localContext);
    }
  };
  
  const handleSuggestContext = async () => {
    setInternalIsLoading(true);
    setInternalError(null);
    setInternalAnalysisResult(null);

    const allTranslations = files.map(f => ({
        lang: f.name,
        value: String(getValueByPath(f.data, translationKey) || ''),
    }));

    try {
        const suggestedContext = await generateContextForKey(
            translationKey, 
            allTranslations, 
            translationHistory, 
            globalContext || ''
        );
        setLocalContext(suggestedContext);
    } catch (e: any) {
        setInternalError(e.message || "An unknown error occurred while suggesting context.");
    } finally {
        setInternalIsLoading(false);
    }
  };

  const handleShowAnalysisPrompt = () => {
    if (!polishFile) return;
    const polishValue = String(getValueByPath(polishFile.data, translationKey) || '');
    const englishTranslation = englishFile ? { lang: englishFile.name, value: String(getValueByPath(englishFile.data, translationKey) || '') } : null;
    const otherTranslations = files
        .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
        .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, translationKey) || ''), }));
    
    const prompt = buildAnalysisPrompt(
        translationKey, localContext, { lang: polishFile.name, value: polishValue }, 
        englishTranslation, otherTranslations, translationHistory, groupReferenceTranslations, globalContext
    );
    setGeneratedPrompt(prompt);
    setIsPromptModalOpen(true);
  };
  
  const handleShowContextPrompt = () => {
     const allTranslations = files.map(f => ({
        lang: f.name,
        value: String(getValueByPath(f.data, translationKey) || ''),
    }));
    const prompt = buildGenerateContextPrompt(
        translationKey, 
        allTranslations,
        translationHistory,
        globalContext || ''
    );
    setGeneratedPrompt(prompt);
    setIsPromptModalOpen(true);
  }

  const handleAnalyze = async () => {
    if (localContext !== parentContext) {
        onUpdateContext(localContext);
    }
    if (!polishFile) {
        setInternalError("A Polish translation file (e.g., 'pl.json') is required as a reference for analysis.");
        return;
    }

    setInternalIsLoading(true);
    setInternalError(null);
    setInternalAnalysisResult(null);
    setRecentlyApplied(new Set());

    const polishValue = String(getValueByPath(polishFile.data, translationKey) || '');
    const englishTranslation = englishFile ? { lang: englishFile.name, value: String(getValueByPath(englishFile.data, translationKey) || '') } : null;

    const otherTranslations = files
        .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
        .map(f => ({
            lang: f.name,
            value: String(getValueByPath(f.data, translationKey) || ''),
        }));

    try {
        const result = await analyzeTranslations(
            translationKey, localContext, { lang: polishFile.name, value: polishValue }, 
            englishTranslation, otherTranslations, translationHistory, groupReferenceTranslations, globalContext
        );
        setInternalAnalysisResult(result);
    } catch (e: any) {
        setInternalError(e.message || "An unknown error occurred during analysis.");
    } finally {
        setInternalIsLoading(false);
    }
  };

  const previewFile = files[previewFileIndex];

  const handleCopyKeyName = () => {
    navigator.clipboard.writeText(translationKey).then(() => {
        setCopiedKeyName(true);
        setTimeout(() => setCopiedKeyName(false), 2000);
    });
  };

  const handleCopyKeyValues = () => {
    const valuesObject = files.reduce((acc, file) => {
        acc[file.name] = getValueByPath(file.data, translationKey);
        return acc;
    }, {} as Record<string, any>);

    const valuesText = JSON.stringify(valuesObject, null, 2);

    navigator.clipboard.writeText(valuesText).then(() => {
        setCopiedKeyValues(true);
        setTimeout(() => setCopiedKeyValues(false), 2000);
    });
  };

  const handleApplySuggestion = (fileName: string, suggestion: string) => {
    onUpdateValue(fileName, translationKey, suggestion);
    setRecentlyApplied(prev => new Set(prev).add(fileName));

    const updateAnalysisState = (currentResult: AIAnalysisResult | null | undefined): AIAnalysisResult | null | undefined => {
        if (!currentResult) return currentResult;
        const newAnalysis = currentResult.analysis.map(item => 
            item.language === fileName ? { ...item, evaluation: 'Good' as 'Good', suggestion: undefined } : item
        );
        return { ...currentResult, analysis: newAnalysis };
    };

    if (showAnalysisControls) {
        setInternalAnalysisResult(updateAnalysisState);
    } else {
        setDisplayAnalysisResult(updateAnalysisState);
    }

    setTimeout(() => {
        setRecentlyApplied(prev => {
            const next = new Set(prev);
            next.delete(fileName);
            return next;
        });
    }, 2000);
  };
  
  const handleApplyAllSuggestions = () => {
    const languagesApplied = new Set<string>();
    unappliedSuggestions.forEach(item => {
        if (item.suggestion) {
            onUpdateValue(item.language, translationKey, item.suggestion);
            languagesApplied.add(item.language);
        }
    });

    setRecentlyApplied(languagesApplied);
    setTimeout(() => setRecentlyApplied(new Set()), 2000);
  };

  const isContextEmpty = !localContext.trim();

  return (
    <>
      <PromptViewerModal
          isOpen={isPromptModalOpen}
          onClose={() => setIsPromptModalOpen(false)}
          prompt={generatedPrompt}
      />
      <div className="flex-grow flex flex-col bg-gray-800/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex flex-col space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center">
                        {onToggleCollapse && (
                           <button onClick={() => onToggleCollapse(translationKey)} className="p-1 rounded-md hover:bg-gray-700 mr-2">
                            {isCollapsed ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronUpIcon className="w-5 h-5" />}
                           </button>
                        )}
                        <p className="text-lg text-teal-400 font-mono break-all">{translationKey}</p>
                         <button onClick={handleCopyKeyName} title="Copy key" className="ml-2 p-1 rounded-md hover:bg-gray-700">
                            {copiedKeyName ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4 text-gray-400 hover:text-white" />}
                        </button>
                        <button onClick={handleCopyKeyValues} title="Copy all values as JSON" className="ml-1 p-1 rounded-md hover:bg-gray-700">
                            {copiedKeyValues ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CodeBracketIcon className="w-4 h-4 text-gray-400 hover:text-white" />}
                        </button>
                    </div>
                    {statusSummary && (
                        <div className="flex items-center space-x-2">
                           <StatusBadge type="Incorrect" count={statusSummary['Incorrect'] || 0} />
                           <StatusBadge type="Needs Improvement" count={statusSummary['Needs Improvement'] || 0} />
                           <StatusBadge type="Good" count={statusSummary['Good'] || 0} />
                        </div>
                    )}
                </div>
            </div>
          </div>
          {!isCollapsed && showAnalysisControls && (
            <>
              <div>
                  <label htmlFor={`ai-context-${translationKey}`} className="block text-sm font-medium text-gray-300 mb-2">
                      Context for AI Analysis
                  </label>
                  <textarea
                      id={`ai-context-${translationKey}`}
                      rows={3}
                      className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                      placeholder="e.g., This key is used on a button for saving a user's profile."
                      value={localContext}
                      onChange={(e) => setLocalContext(e.target.value)}
                      onBlur={handleContextBlur}
                  />
              </div>
              <div className="flex items-end justify-end gap-2">
                  <button
                    onClick={isContextEmpty ? handleShowContextPrompt : handleShowAnalysisPrompt}
                    disabled={isLoading || (!isContextEmpty && !polishFile)}
                    className="p-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Show prompt that will be sent to the AI"
                  >
                      <CodeBracketIcon className="w-5 h-5"/>
                  </button>
                  <button 
                      onClick={isContextEmpty ? handleSuggestContext : handleAnalyze}
                      disabled={isLoading || (!isContextEmpty && !polishFile)}
                      className="flex-1 flex items-center justify-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                      {isContextEmpty ? (
                          <>
                              <LightBulbIcon className="w-5 h-5"/>
                              <span>{isLoading ? 'Suggesting...' : 'Suggest Context with AI'}</span>
                          </>
                      ) : (
                          <>
                              <SparklesIcon className="w-5 h-5"/>
                              <span>{isLoading ? 'Analyzing...' : 'Analyze with AI'}</span>
                          </>
                      )}
                  </button>
              </div>
            </>
          )}
        </div>
        
        {!isCollapsed && (
            <div className={`flex-grow p-4 lg:p-6 grid grid-cols-1 ${showFilePreview ? 'lg:grid-cols-2' : ''} gap-6 overflow-hidden min-h-0`}>
                <div className={`flex flex-col animate-fade-in overflow-hidden ${!isPreviewVisible && showFilePreview ? 'lg:col-span-2' : ''}`}>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-md font-semibold text-gray-300">Values by Language</h3>
                        <div className="flex items-center space-x-2">
                        {unappliedSuggestions.length > 0 && (
                            <button
                            onClick={handleApplyAllSuggestions}
                            className="text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-500 text-white"
                            title={`Apply ${unappliedSuggestions.length} AI suggestions`}
                            >
                            <BoltIcon className="w-4 h-4" />
                            <span>Apply All</span>
                            </button>
                        )}
                        {showFilePreview && (
                            <button
                                onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                                className="hidden lg:flex items-center space-x-2 text-xs font-medium py-1 px-2 rounded-md transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-gray-200"
                                title={isPreviewVisible ? 'Hide file preview' : 'Show file preview'}
                            >
                                {isPreviewVisible ? <PanelCloseIcon className="w-4 h-4" /> : <PanelOpenIcon className="w-4 h-4" />}
                            </button>
                        )}
                        </div>
                    </div>
                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md mb-4">
                            <h3 className="font-bold">Analysis Failed</h3>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    <div className="overflow-y-auto flex-grow -mr-2 pr-2">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-gray-800/90 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="p-3 w-32 font-semibold text-sm text-gray-400">Language</th>
                                    <th className="p-3 font-semibold text-sm text-gray-400">Value</th>
                                    <th className="p-3 w-2/5 font-semibold text-sm text-gray-400">AI Analysis</th>
                                </tr>
                            </thead>
                            <tbody>
                            {files.map((file, index) => {
                                const value = getValueByPath(file.data, translationKey);
                                const lineNumber = getLineNumber(file.data, translationKey);
                                const isActive = index === previewFileIndex;
                                const isPolishReference = file.name === polishFile?.name;
                                const isEnglishReference = file.name === englishFile?.name;
                                const analysis = analysisResult?.analysis.find(a => a.language === file.name);

                                return (
                                    <tr 
                                        key={file.name} 
                                        onClick={() => showFilePreview && setPreviewFileIndex(index)}
                                        className={`group transition-colors duration-200 ${showFilePreview ? 'cursor-pointer' : ''} ${isActive && showFilePreview ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'}`}
                                    >
                                    <td className={`p-3 w-32 align-top ${isActive && showFilePreview ? 'border-l-2 border-teal-500' : 'border-l-2 border-transparent'}`}>
                                        <div className="flex flex-col">
                                        <span className="font-bold text-sm truncate text-gray-400" title={file.name}>{file.name}</span>
                                        <span className="text-xs font-mono text-gray-500 mt-1">
                                            {lineNumber !== null ? `L${lineNumber}` : 'N/A'}
                                        </span>
                                        </div>
                                    </td>
                                    <td className="p-3 align-top">
                                        <ValueDisplay value={value} onSave={(newValue) => onUpdateValue(file.name, translationKey, newValue)} />
                                    </td>
                                    <td className="p-3 align-top text-sm">
                                        {isLoading && (
                                            <div className="flex items-center space-x-2 text-gray-400">
                                                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Analyzing...</span>
                                            </div>
                                        )}
                                        {(isPolishReference || isEnglishReference) && !analysisResult && !isLoading && (
                                            <div className="text-xs text-gray-500 italic">
                                                {isPolishReference ? 'Source of Truth (PL)' : 'Primary Reference (EN)'}
                                            </div>
                                        )}
                                        {analysis && (
                                            <AnalysisResultDisplay
                                                analysis={analysis}
                                                currentValue={value}
                                                onApplySuggestion={(suggestion) => handleApplySuggestion(file.name, suggestion)}
                                                recentlyApplied={recentlyApplied.has(file.name)}
                                            />
                                        )}
                                    </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {showFilePreview && (
                    <div className={`hidden ${isPreviewVisible ? 'lg:flex' : 'lg:hidden'} flex-col animate-fade-in overflow-hidden`}>
                        <h3 className="text-md font-semibold text-gray-300 mb-3">File Preview: <span className="font-bold text-teal-400">{previewFile?.name}</span></h3>
                        {previewFile ? (
                            <JsonFileViewer jsonData={previewFile.data} selectedKey={translationKey} />
                        ) : (
                            <div className="flex items-center justify-center h-full bg-gray-900/70 rounded-lg border border-gray-700">
                                <p className="text-gray-500">Select a language to preview the file.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
      </div>
    </>
  );
};
