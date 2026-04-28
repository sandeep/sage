'use client';
import { createContext, useContext, useState } from 'react';

const PrivacyContext = createContext<{ privacy: boolean; toggle: () => void }>({
    privacy: true,
    toggle: () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
    const [privacy, setPrivacy] = useState(true);
    return (
        <PrivacyContext.Provider value={{ privacy, toggle: () => setPrivacy(p => !p) }}>
            {children}
        </PrivacyContext.Provider>
    );
}

export function usePrivacy() {
    return useContext(PrivacyContext);
}
