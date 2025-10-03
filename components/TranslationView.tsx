import React from 'react';
import type { TranslationFile, TranslationHistory } from '../types';
import { TranslationAnalysisCard } from './TranslationAnalysisCard';

interface TranslationViewProps {
  files: TranslationFile[];
  selectedKey: string;
  onUpdateValue: (fileName: string, key: string, newValue: any) => void;
  context: string;
  onUpdateContext: (newContext: string) => void;
  translationHistory: TranslationHistory;
  globalContext: string;
}

export const TranslationView: React.FC<TranslationViewProps> = (props) => {
  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
        <TranslationAnalysisCard 
            translationKey={props.selectedKey}
            files={props.files}
            context={props.context}
            translationHistory={props.translationHistory}
            onUpdateValue={props.onUpdateValue}
            onUpdateContext={props.onUpdateContext}
            showFilePreview={true}
            globalContext={props.globalContext}
        />
    </div>
  );
};
