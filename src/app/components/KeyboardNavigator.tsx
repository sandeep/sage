'use client';
// src/app/components/KeyboardNavigator.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KeyboardNavigator() {
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if not in an input or textarea
            if (
                document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA'
            ) {
                return;
            }

            // 'Esc' or 'd' to go to dashboard
            if (e.key === 'Escape' || e.key === 'd') {
                router.push('/');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    return null; // This component doesn't render anything
}
