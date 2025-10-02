
import React, { useState, useEffect, useMemo, useRef } from 'react';
// FIX: Add Glossary to the type imports.
import type { TranslationFile, AIAnalysisResult, AnalysisItem, TranslationHistory, Glossary } from '../types';
import { getValueByPath, getLineNumber } from '../services/translationService';
import { analyzeTranslations, generateContextForKey, buildAnalysisPrompt, buildGenerateContextPrompt } from '../services/aiService';
import { CheckIcon, EditIcon, ClipboardIcon, SparklesIcon, PanelOpenIcon, PanelCloseIcon, BoltIcon, PlusCircleIcon, LightBulbIcon, CloseIcon, CodeBracketIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import { JsonFileViewer } from './JsonFileViewer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PromptViewerModal } from './PromptViewerModal';


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
  // FIX: Add optional glossary prop.
  glossary?: Glossary;
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

const EvaluationBadge: React.FC<{ evaluation: 'Good' | 'Needs Improvement' | 'Incorrect' }> = ({ evaluation }) => {
  const baseClasses = "text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full inline-block";
  const styles = {
    'Good': "bg-green-900 text-green-300",
    'Needs Improvement': "bg-yellow-900 text-yellow-300",
    'Incorrect': "bg-red-900 text-red-300",
  };
  return <span className={`${baseClasses} ${styles[evaluation]}`}>{evaluation}</span>;
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
      // FIX: Destructure glossary from props.
      glossary,
  } = props;
  
  const [previewFileIndex, setPreviewFileIndex] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [localContext, setLocalContext] = useState('');
  
  const [recentlyApplied, setRecentlyApplied] = useState<Set<string>>(new Set());

  // Self-managed state for when the card has its own controls
  const [selfManagedAnalysisResult, setSelfManagedAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [selfManagedIsLoading, setSelfManagedIsLoading] = useState(false);
  const [selfManagedError, setSelfManagedError] = useState<string | null>(null);
  
  // Local copy of analysis result when it's passed as a prop, to allow for local modifications (e.g., updating status on apply)
  const [localAnalysisResult, setLocalAnalysisResult] = useState<AIAnalysisResult | null | undefined>(analysisResultProp);

  useEffect(() => {
      setLocalAnalysisResult(analysisResultProp);
  }, [analysisResultProp]);

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // Decide which state to use based on whether controls are shown
  const analysisResult = showAnalysisControls ? selfManagedAnalysisResult : localAnalysisResult;
  const isLoading = showAnalysisControls ? selfManagedIsLoading : isLoadingProp;
  const error = showAnalysisControls ? selfManagedError : errorProp;

  const polishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('pl') || f.name.toLowerCase().includes('polish')), [files]);
  const englishFile = useMemo(() => files.find(f => f.name.toLowerCase().includes('en') || f.name.toLowerCase().includes('english')), [files]);

  useEffect(() => {
    if (previewFileIndex >= files.length && files.length > 0) {
        setPreviewFileIndex(0);
    }
  }, [files, previewFileIndex]);

  useEffect(() => {
      setSelfManagedAnalysisResult(null);
      setSelfManagedError(null);
      setLocalContext(parentContext || '');
      setRecentlyApplied(new Set());
  }, [translationKey, parentContext]);
  
  const unappliedSuggestions = useMemo(() => {
    if (!analysisResult?.analysis) return [];
    
    const suggestions: {language: string, suggestion: string}[] = [];
    analysisResult.analysis.forEach(item => {
        if (!item.suggestion || !item.suggestion.trim()) return;
        const file = files.find(f => f.name === item.language);
        if (!file) return;

        const currentValue = getValueByPath(file.data, translationKey);
        if (currentValue !== item.suggestion) {
            if (!suggestions.some(s => s.language === item.language)) {
                suggestions.push({ language: item.language, suggestion: item.suggestion });
            }
        }
    });
    
    return suggestions;
  }, [analysisResult, files, translationKey]);

   const statusSummary = useMemo(() => {
    if (!analysisResult?.analysis) return null;
    const counts: Record<string, number> = {
        'Good': 0,
        'Needs Improvement': 0,
        'Incorrect': 0,
    };
    analysisResult.analysis.forEach(item => {
        counts[item.evaluation] = (counts[item.evaluation] || 0) + 1;
    });
    return counts;
  }, [analysisResult]);


  const handleContextBlur = () => {
    if (localContext !== parentContext) {
        onUpdateContext(localContext);
    }
  };
  
  const handleSuggestContext = async () => {
    setSelfManagedIsLoading(true);
    setSelfManagedError(null);
    setSelfManagedAnalysisResult(null);

    const allTranslations = files.map(f => ({
        lang: f.name,
        value: String(getValueByPath(f.data, translationKey) || ''),
    }));

    try {
        const suggestedContext = await generateContextForKey(translationKey, allTranslations);
        setLocalContext(suggestedContext);
    } catch (e: any) {
        setSelfManagedError(e.message || "An unknown error occurred while suggesting context.");
    } finally {
        setSelfManagedIsLoading(false);
    }
  };

  const handleShowAnalysisPrompt = () => {
    if (!polishFile) return;
     const polishValue = String(getValueByPath(polishFile.data, translationKey) || '');
    const englishTranslation = englishFile ? { lang: englishFile.name, value: String(getValueByPath(englishFile.data, translationKey) || '') } : null;
    const otherTranslations = files
        .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
        .map(f => ({ lang: f.name, value: String(getValueByPath(f.data, translationKey) || ''), }));
    
    // FIX: Pass glossary to buildAnalysisPrompt.
    const prompt = buildAnalysisPrompt(translationKey, localContext, { lang: polishFile.name, value: polishValue }, englishTranslation, otherTranslations, translationHistory, groupReferenceTranslations, glossary);
    setGeneratedPrompt(prompt);
    setIsPromptModalOpen(true);
  };
  
  const handleShowContextPrompt = () => {
     const allTranslations = files.map(f => ({
        lang: f.name,
        value: String(getValueByPath(f.data, translationKey) || ''),
    }));
    const prompt = buildGenerateContextPrompt(translationKey, allTranslations);
    setGeneratedPrompt(prompt);
    setIsPromptModalOpen(true);
  }

  const handleAnalyze = async () => {
    if (localContext !== parentContext) {
        onUpdateContext(localContext);
    }

    setSelfManagedIsLoading(true);
    setSelfManagedError(null);
    setSelfManagedAnalysisResult(null);
    setRecentlyApplied(new Set());

    if (!polishFile) {
        setSelfManagedError("A Polish translation file (e.g., 'pl.json') is required as a reference for analysis.");
        setSelfManagedIsLoading(false);
        return;
    }

    const polishValue = String(getValueByPath(polishFile.data, translationKey) || '');
    const englishTranslation = englishFile ? { lang: englishFile.name, value: String(getValueByPath(englishFile.data, translationKey) || '') } : null;

    const otherTranslations = files
        .filter(f => f.name !== polishFile.name && f.name !== englishFile?.name)
        .map(f => ({
            lang: f.name,
            value: String(getValueByPath(f.data, translationKey) || ''),
        }));

    try {
        // FIX: Pass glossary to analyzeTranslations.
        const result = await analyzeTranslations(
            translationKey,
            localContext, 
            { lang: polishFile.name, value: polishValue }, 
            englishTranslation,
            otherTranslations, 
            translationHistory,
            groupReferenceTranslations,
            glossary
        );
        setSelfManagedAnalysisResult(result);
    } catch (e: any) {
        setSelfManagedError(e.message || "An unknown error occurred during analysis.");
    } finally {
        setSelfManagedIsLoading(false);
    }
  };

  const previewFile = files[previewFileIndex];
  
  const handleCopyToClipboard = () => {
    const tsvContent = files.map(file => {
        const value = getValueByPath(file.data, translationKey);
        let valueString: string;
        
        if (typeof value === 'object' && value !== null) {
            valueString = JSON.stringify(value);
        } else if (value === undefined || value === null) {
            valueString = "";
        } else {
            valueString = String(value);
        }
        const sanitizedValue = valueString.replace(/\t|\n|\r/g, ' ');
        return `${file.name}\t${sanitizedValue}`;
    }).join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(translationKey).then(() => {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    });
  };


  const handleApplySuggestion = (fileName: string, suggestion: string) => {
    onUpdateValue(fileName, translationKey, suggestion);
    setRecentlyApplied(prev => new Set(prev).add(fileName));

    const updateAnalysisState = (currentResult: AIAnalysisResult | null | undefined): AIAnalysisResult | null | undefined => {
        if (!currentResult) return currentResult;
        const newAnalysis = currentResult.analysis.map(item => {
            if (item.language === fileName) {
                // When a suggestion is applied, we optimistically update its status to 'Good'
                // and remove the suggestion text to prevent re-application.
                return { ...item, evaluation: 'Good' as 'Good', suggestion: undefined };
            }
            return item;
        });
        return { ...currentResult, analysis: newAnalysis };
    };

    if (showAnalysisControls) {
        setSelfManagedAnalysisResult(updateAnalysisState);
    } else {
        setLocalAnalysisResult(updateAnalysisState);
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
        onUpdateValue(item.language, translationKey, item.suggestion);
        languagesApplied.add(item.language);
    });

    setRecentlyApplied(languagesApplied);
    setTimeout(() => {
        setRecentlyApplied(new Set());
    }, 2000);
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
                         <button onClick={handleCopyKey} title="Copy key" className="ml-2 p-1 rounded-md hover:bg-gray-700">
                            {copiedKey ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4 text-gray-400 hover:text-white" />}
                        </button>
                    </div>
                    {statusSummary && (
                        <div className="flex items-center space-x-2">
                           <StatusBadge type="Incorrect" count={statusSummary['Incorrect']} />
                           <StatusBadge type="Needs Improvement" count={statusSummary['Needs Improvement']} />
                           <StatusBadge type="Good" count={statusSummary['Good']} />
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
                        <button
                            onClick={handleCopyToClipboard}
                            className={`text-xs font-medium py-1 px-3 rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                                copied
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            }`}
                            >
                            {copied ? ( <> <CheckIcon className="w-4 h-4" /> <span>Copied!</span> </> ) 
                            : ( <> <ClipboardIcon className="w-4 h-4" /> <span>Copy</span> </> )}
                        </button>
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
                                const polishValue = polishFile ? String(getValueByPath(polishFile.data, translationKey) || '') : '';
                                const lineNumber = getLineNumber(file.data, translationKey);
                                const handleSave = (newValue: any) => onUpdateValue(file.name, translationKey, newValue);
                                const isActive = index === previewFileIndex;
                                
                                const rowClasses = [
                                    'group', showFilePreview ? 'cursor-pointer' : '', 'transition-colors', 'duration-200',
                                    isActive && showFilePreview ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'
                                ].join(' ');
                                
                                const isPolishReference = file.name === polishFile?.name;
                                const isEnglishReference = file.name === englishFile?.name;
                                
                                const analysis = analysisResult?.analysis.find(a => a.language === file.name);

                                return (
                                    <tr 
                                        key={file.name} 
                                        onClick={() => showFilePreview && setPreviewFileIndex(index)}
                                        className={rowClasses}
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
                                        <ValueDisplay value={value} onSave={handleSave} />
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
                                                {isEnglishReference ? 'Primary Reference (EN)' : 'Source of Truth (PL)'}
                                            </div>
                                        )}
                                        {analysis && (
                                            <div className="py-3 flex flex-col gap-2 items-start">
                                                <EvaluationBadge evaluation={analysis.evaluation} />
                                                <MarkdownRenderer content={analysis.feedback} />
                                                {analysis.suggestion?.trim() && (() => {
                                                    const suggestion = analysis.suggestion.trim();
                                                    const isApplied = value === suggestion;
                                                    const wasRecentlyApplied = recentlyApplied.has(file.name);
                                                    const showAppliedState = isApplied || wasRecentlyApplied;
                                                    
                                                    return (
                                                    <div className="p-2 bg-gray-900/50 rounded-md border border-gray-700 w-full">
                                                        <p className="text-xs text-gray-400 mb-1">Suggestion:</p>
                                                        <p className="font-mono text-teal-300 text-xs mb-2">"{suggestion}"</p>
                                                        <div className="flex items-center space-x-2">
                                                            {showAppliedState ? (
                                                                <button 
                                                                    disabled
                                                                    className="text-xs bg-gray-600 text-gray-300 font-semibold py-1 px-2 rounded-md flex items-center space-x-1 cursor-default"
                                                                >
                                                                    <CheckIcon className="w-3 h-3" />
                                                                    <span>Applied</span>
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleApplySuggestion(file.name, suggestion);
                                                                    }}
                                                                    className="text-xs bg-teal-700 hover:bg-teal-600 text-white font-semibold py-1 px-2 rounded-md transition-colors"
                                                                >
                                                                    Apply Suggestion
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    );
                                                })()}
                                            </div>
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
