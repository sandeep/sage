'use client';
import React, { createContext, useContext, useState } from 'react';

type Console = 'portfolio' | 'alpha';
const WorkspaceContext = createContext<{
    activeConsole: Console;
    setConsole: (c: Console) => void;
    isSyncOpen: boolean;
    setSyncOpen: (o: boolean) => void;
} | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const [activeConsole, setConsole] = useState<Console>('portfolio');
    const [isSyncOpen, setSyncOpen] = useState(false);
    return (
        <WorkspaceContext.Provider value={{ activeConsole, setConsole, isSyncOpen, setSyncOpen }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return context;
}
