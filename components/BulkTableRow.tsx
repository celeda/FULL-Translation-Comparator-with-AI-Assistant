import React from 'react';
import type { TranslationFile, AnalysisItem } from '../types';
import { getValueByPath } from '../services/translationService';
import { EditableTextarea } from './EditableTextarea';
import { AnalysisResultDisplay } from './AnalysisResultDisplay';
import { StarIcon } from './Icons';

interface BulkTableRowProps {
  translationKey: string;
  visibleLangs: string[];
  files: TranslationFile[];
  contexts: Record<string, any>;
  editedValues: Record<string, Record<string, string>>;
  analysisData: Record<string, AnalysisItem | null> | undefined;
  onValueChange: (key: string, lang: string, value: string) => void;
  onContextChange: (key: string, value: string) => void;
  isLoading: boolean;
  polishLangName: string;
  isReference: boolean;
  onToggleReference: () => void;
}

export const BulkTableRow: React.FC<BulkTableRowProps> = ({
  translationKey: key,
  visibleLangs,
  files,
  contexts,
  editedValues,
  analysisData,
  onValueChange,
  onContextChange,
  isLoading,
  polishLangName,
  isReference,
  onToggleReference,
}) => {
  return (
    <tr className="hover:bg-gray-800/30">
        <td className="p-2 align-top break-words border-b border-gray-700 sticky left-0 z-10 bg-gray-800">
            <p className="font-mono text-teal-300 text-xs">{key}</p>
            <EditableTextarea
                initialValue={String(getValueByPath(contexts, key) || '')}
                onSave={(newValue) => onContextChange(key, newValue)}
                placeholder="No context"
                className="text-xs text-gray-400 italic mt-1 w-full bg-gray-900 border border-gray-700 rounded p-1 resize-y"
                rows={2}
            />
        </td>
        <td className="p-2 align-top text-center border-b border-gray-700 sticky left-[250px] z-10 bg-gray-800">
            <button onClick={onToggleReference} className="p-1" title="Mark as a global reference key for AI">
                <StarIcon className={`w-5 h-5 transition-colors ${isReference ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-500'}`} />
            </button>
        </td>
        {visibleLangs.map(lang => {
            const langFile = files.find(f => f.name === lang);
            const currentValue = editedValues[lang]?.[key] ?? String(getValueByPath(langFile?.data, key) ?? '');
            const analysis = analysisData?.[lang];
            
            return (
                <td 
                    key={lang} 
                    className={`p-2 align-top break-words border-b border-gray-700 
                    ${lang === polishLangName ? 'sticky left-[298px] z-10 bg-gray-800' : ''}`}
                >
                   <EditableTextarea
                        initialValue={currentValue}
                        onSave={(newValue) => onValueChange(key, lang, newValue)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-1.5 text-gray-200 resize-y"
                        rows={2}
                        placeholder={langFile ? 'Empty' : 'File not loaded'}
                        disabled={!langFile}
                   />
                   {isLoading && !analysis && (
                        <div className="text-xs text-gray-500 italic mt-2">Analyzing...</div>
                   )}
                   {analysis && (
                       <div className="mt-2">
                         <AnalysisResultDisplay
                            analysis={analysis}
                            currentValue={currentValue}
                            onApplySuggestion={(suggestion) => onValueChange(key, lang, suggestion)}
                            recentlyApplied={false} // Inline apply is more direct, no need for this state here
                         />
                       </div>
                   )}
                </td>
            )
        })}
    </tr>
  );
};
