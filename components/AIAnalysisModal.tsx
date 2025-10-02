
import React from 'react';
import type { AIAnalysisResult } from '../types';
import { CloseIcon, SparklesIcon } from './Icons';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  analysisResult: AIAnalysisResult | null;
  context: string;
}

const EvaluationBadge: React.FC<{ evaluation: 'Good' | 'Needs Improvement' | 'Incorrect' }> = ({ evaluation }) => {
  const baseClasses = "text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full";
  const styles = {
    'Good': "bg-green-900 text-green-300",
    'Needs Improvement': "bg-yellow-900 text-yellow-300",
    'Incorrect': "bg-red-900 text-red-300",
  };
  return <span className={`${baseClasses} ${styles[evaluation]}`}>{evaluation}</span>;
};


export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({ isOpen, onClose, isLoading, error, analysisResult, context }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <SparklesIcon className="w-6 h-6 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">AI Translation Analysis</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-400">Analyzing translations...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md">
              <h3 className="font-bold">Analysis Failed</h3>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-6">
               <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Context</h3>
                  <p className="text-gray-200 bg-gray-900/50 p-3 rounded-md border border-gray-700">"{context}"</p>
               </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Results</h3>
                <div className="space-y-4">
                  {analysisResult.analysis.map((item, index) => (
                    <div key={index} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                      <div className="flex items-center mb-2">
                        <EvaluationBadge evaluation={item.evaluation} />
                        <h4 className="font-bold text-gray-200">{item.language}</h4>
                      </div>
                      <p className="text-gray-300 text-sm">{item.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};