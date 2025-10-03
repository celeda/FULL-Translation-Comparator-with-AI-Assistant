export interface TranslationFile {
  name: string;
  data: Record<string, any>;
}

export interface AnalysisItem {
  language: string;
  evaluation: 'Good' | 'Needs Improvement' | 'Incorrect';
  feedback: string;
  suggestion?: string;
}

export interface AIAnalysisResult {
  analysis: AnalysisItem[];
}

// Stores user's manual overrides for specific translation keys.
// This acts as a translation memory.
// Example: { "buttons.submit": { "en": "Submit Application" } }
export type TranslationHistory = Record<string, Record<string, string>>;

// FIX: Add Glossary type definition to fix import error.
// A glossary for consistent terminology across the app.
// Example: { "Aplikacja": { "en": "Application", "de": "Anwendung" } }
export type Glossary = Record<string, Record<string, string>>;

export interface TranslationGroup {
  id: string;
  name: string;
  context: string;
  keys: string[];
  referenceKeys: string[];
}