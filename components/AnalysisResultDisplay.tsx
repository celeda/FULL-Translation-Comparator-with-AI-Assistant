
import React from 'react';
import type { AnalysisItem } from '../types';
import { CheckIcon } from './Icons';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AnalysisResultDisplayProps {
  analysis: AnalysisItem;
  currentValue: any;
  onApplySuggestion: (suggestion: string) => void;
  recentlyApplied: boolean;
}

const EvaluationBadge: React.FC<{ evaluation: 'Good' | 'Needs Improvement' | 'Incorrect' }> = ({ evaluation }) => {
  const baseClasses = "text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full inline-block";
  const styles = {
    'Good': "bg-green-900 text-green-300",
    'Needs Improvement': "bg-yellow-900 text-yellow-300",
    'Incorrect': "bg-red-900 text-red-300",
  };
  return <span className={`${baseClasses} ${styles[evaluation]}`}>{evaluation}</span>;
};

export const AnalysisResultDisplay: React.FC<AnalysisResultDisplayProps> = ({ analysis, currentValue, onApplySuggestion, recentlyApplied }) => {
  if (!analysis) return null;
  
  const suggestion = analysis.suggestion?.trim();
  const isApplied = suggestion && currentValue === suggestion;

  return (
    <div className="py-3 flex flex-col gap-2 items-start">
      <EvaluationBadge evaluation={analysis.evaluation} />
      <MarkdownRenderer content={analysis.feedback} />
      {suggestion && (
        <div className="p-2 bg-gray-900/50 rounded-md border border-gray-700 w-full">
          <p className="text-xs text-gray-400 mb-1">Suggestion:</p>
          <p className="font-mono text-teal-300 text-xs mb-2">"{suggestion}"</p>
          <div className="flex items-center space-x-2">
            {isApplied || recentlyApplied ? (
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
                  onApplySuggestion(suggestion);
                }}
                className="text-xs bg-teal-700 hover:bg-teal-600 text-white font-semibold py-1 px-2 rounded-md transition-colors"
              >
                Apply Suggestion
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};