
import React, { useState, useCallback } from 'react';
import type { TranslationFile, TranslationHistory, TranslationGroup } from '../types';
import { UploadIcon } from './Icons';

// JSZip is loaded from a script tag in index.html
declare var JSZip: any;

interface FileUploaderProps {
  onFilesUploaded: (result: { 
      translationFiles: TranslationFile[], 
      contexts: Record<string, string>, 
      history: TranslationHistory, 
      groups: TranslationGroup[],
  }) => void;
  compact?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesUploaded, compact = false }) => {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(async (fileList: FileList) => {
    setError(null);
    let filesToProcess: {name: string, text: () => Promise<string>}[] = Array.from(fileList).map(f => ({ name: f.name, text: () => f.text() }));

    const defaultResult = { translationFiles: [], contexts: {}, history: {}, groups: [] };

    if (filesToProcess.length === 1 && (filesToProcess[0].name.endsWith('.zip') || fileList[0].type === 'application/zip')) {
      try {
        const zipFile = fileList[0];
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(zipFile);
        const unzippedFiles: {name: string, text: () => Promise<string>}[] = [];
        zip.forEach((relativePath: string, file: any) => {
          if (!file.dir && file.name.endsWith('.json')) {
            unzippedFiles.push({
              name: file.name.split('/').pop() || file.name, // get just filename
              text: () => file.async('string'),
            });
          }
        });
        filesToProcess = unzippedFiles;
      } catch (err: any) {
        setError(`Failed to read ZIP file. Error: ${err.message}`);
        onFilesUploaded(defaultResult);
        return;
      }
    }


    const translationFiles: TranslationFile[] = [];
    let contexts: Record<string, string> = {};
    let history: TranslationHistory = {};
    let groups: TranslationGroup[] = [];

    for (const file of filesToProcess) {
      if (!file.name.endsWith('.json')) {
        setError(`File "${file.name}" is not a valid JSON file.`);
        onFilesUploaded(defaultResult);
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (file.name === 'context.json') {
          contexts = data;
        } else if (file.name === 'history.json') {
          history = data;
        } else if (file.name === 'groups.json') {
          groups = data;
        } else {
          const fileName = file.name.replace('.json', '');
          translationFiles.push({ name: fileName, data });
        }
      } catch (err) {
        setError(`Error parsing "${file.name}". Please ensure it's valid JSON.`);
        onFilesUploaded(defaultResult);
        return;
      }
    }
    
    if (translationFiles.length === 0) {
        setError('Please upload at least one JSON translation file.');
        onFilesUploaded(defaultResult);
        return;
    }

    onFilesUploaded({ translationFiles, contexts, history, groups });
  }, [onFilesUploaded]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
    }
  }, [processFiles]);
  
  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  if (compact) {
    return (
        <div>
            <label htmlFor="file-upload-compact" className="w-full flex items-center justify-center cursor-pointer text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-md transition-colors duration-200">
                Upload New Files
            </label>
            <input 
                id="file-upload-compact" 
                type="file" 
                multiple 
                accept=".json,.zip" 
                onChange={handleFileChange} 
                className="hidden"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
    );
  }

  return (
    <div className="w-full">
      <label
        htmlFor="file-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${isDragging ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700/50'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadIcon className="w-10 h-10 mb-3 text-gray-400" />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold text-teal-400">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">JSON files or a single ZIP file</p>
          <p className="text-xs text-gray-500 mt-1">Optional: `context.json`, `history.json`, `groups.json`</p>
        </div>
        <input 
          id="file-upload" 
          type="file" 
          multiple 
          accept=".json,.zip" 
          onChange={handleFileChange} 
          className="hidden"
        />
      </label>
      {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
    </div>
  );
};
