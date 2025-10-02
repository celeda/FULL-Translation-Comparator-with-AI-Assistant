
import React, { useState, useEffect } from 'react';
import { SearchIcon } from './Icons';

interface ValueSearchPanelProps {
  onSearch: (term: string, lang: string) => void;
  languages: string[];
}

export const ValueSearchPanel: React.FC<ValueSearchPanelProps> = ({ onSearch, languages }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchLang, setSearchLang] = useState('');

    useEffect(() => {
        if (languages.length > 0 && !searchLang) {
            // Try to default to Polish or English
            const pl = languages.find(l => l.toLowerCase().includes('pl'));
            const en = languages.find(l => l.toLowerCase().includes('en'));
            setSearchLang(pl || en || languages[0]);
        }
    }, [languages, searchLang]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchTerm, searchLang);
    };

    return (
        <form onSubmit={handleSearch} className="p-4 space-y-4 flex-grow flex flex-col">
            <div className="space-y-4">
                <div>
                    <label htmlFor="search-term" className="block text-sm font-medium text-gray-300 mb-2">
                        Search Term
                    </label>
                    <div className="relative">
                        <input
                            id="search-term"
                            type="text"
                            placeholder="e.g., 'Licencja'"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                </div>
                <div>
                    <label htmlFor="search-lang" className="block text-sm font-medium text-gray-300 mb-2">
                        In Language
                    </label>
                    <select
                        id="search-lang"
                        value={searchLang}
                        onChange={e => setSearchLang(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    >
                        {languages.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="mt-auto">
                <button
                    type="submit"
                    disabled={!searchTerm.trim() || !searchLang}
                    className="w-full flex items-center justify-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <span>Search</span>
                </button>
            </div>
        </form>
    );
};