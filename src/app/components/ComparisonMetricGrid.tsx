'use client';
import React from 'react';

const Row = ({ label, actualVal, targetVal, format, colorActual = "text-risk", colorTarget = "text-accent" }: {
    label: string,
    actualVal: number | null,
    targetVal: number | null,
    format: (v: number) => string, // Expect a valid number
    colorActual?: string,
    colorTarget?: string
}) => (
    <div className="flex items-center justify-between border-t border-border py-8 group">
        <div className="ui-label text-truth group-hover:text-white transition-colors">
            {label}
        </div>
        <div className="flex items-center w-1/2">
            <div className="flex-1 text-right pr-12">
                <span className={`${colorActual} ui-metric`}>
                    {actualVal !== null && actualVal !== undefined ? format(actualVal) : '—'}
                </span>
            </div>
            <div className="flex-1 text-right pl-12">
                <span className={`${colorTarget} ui-metric`}>
                    {targetVal !== null && targetVal !== undefined ? format(targetVal) : '—'}
                </span>
            </div>
        </div>
    </div>
);

export default function ComparisonMetricGrid({ actual, target, dataNote }: {
    actual: any | null,
    target: any | null,
    dataNote: string | null
}) {
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtNum = (v: number) => v.toFixed(2);

    return (
        <div>
            <div className="flex items-center justify-between pb-8">
                <div className="w-1/2" />
                <div className="w-1/2 flex items-center justify-between ui-caption">
                    <div className="flex-1 text-right pr-12 text-risk">Actual (Sim)</div>
                    <div className="flex-1 text-right pl-12 text-accent">Strategy</div>
                </div>
            </div>

            <Row label="Annualized Return (CAGR)" actualVal={actual?.annualizedReturn} targetVal={target?.annualizedReturn} format={fmtPct} />
            <Row label="Annualized Volatility" actualVal={actual?.volatility} targetVal={target?.volatility} format={fmtPct} colorActual="text-truth" colorTarget="text-truth" />
            <Row label="Sharpe Ratio (Rf 5.0%)" actualVal={actual?.sharpe} targetVal={target?.sharpe} format={fmtNum} />
            <Row label="M2 / Sortino II" actualVal={actual?.m2} targetVal={target?.m2} format={fmtNum} />
            <Row label="Max Drawdown" actualVal={actual?.maxDrawdown} targetVal={target?.maxDrawdown} format={fmtPct} colorActual="text-risk" colorTarget="text-risk" />
            <Row label="Ulcer Index (Severity)" actualVal={actual?.ulcer} targetVal={target?.ulcer} format={fmtNum} colorActual="text-risk" colorTarget="text-risk" />
            
            {dataNote && (
                <div className="ui-caption italic leading-relaxed pt-8 flex gap-4">
                    <span className="text-amber-500 font-black">Note:</span>
                    <span>{dataNote}</span>
                </div>
            )}
        </div>
    );
}
