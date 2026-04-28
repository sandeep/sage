'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    title: string;
    content: string;
    children: React.ReactNode;
}

export default function FloatingTooltip({ title, content, children }: Props) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                x: rect.left + rect.width / 2,
                y: rect.top - 10
            });
        }
    };

    return (
        <div 
            ref={triggerRef}
            className="inline-block relative cursor-help"
            onMouseEnter={() => {
                updateCoords();
                setIsVisible(true);
            }}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {mounted && isVisible && createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none transition-all duration-200 ease-out"
                    style={{ 
                        left: coords.x, 
                        top: coords.y,
                        transform: 'translateX(-50%) translateY(-100%)'
                    }}
                >
                    <div className="bg-zinc-950 border border-zinc-800 rounded-sm shadow-2xl p-4 w-64 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 border-b border-zinc-900 pb-2">
                            {title}
                        </div>
                        <div className="text-[11px] leading-relaxed text-zinc-400 font-mono italic">
                            {content}
                        </div>
                        {/* Arrow */}
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-950 border-r border-b border-zinc-800 rotate-45" />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
