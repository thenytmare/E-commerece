'use client';

import React, { createContext, useContext, useState } from 'react';

type SearchContextValue = {
  isOpen: boolean;
  query: string;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
};

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  return (
    <SearchContext.Provider value={{ isOpen, query, open: () => setIsOpen(true), close, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error('useSearch must be used within a SearchProvider');
  return context;
}
