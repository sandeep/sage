'use client';
import React from 'react';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from './ui/tooltip';

export interface MetricInfo {
    label: string;
    description: string;
    direction: 'higher' | 'lower' | 'neutral';
    directionNote: string;
}

export const METRIC_INFO: Record<string, MetricInfo> = {
    return: {
        label: 'Return',
        description: 'Total portfolio return over the period.',
        direction: 'higher',
        directionNote: 'Higher is better.',
    },
    sharpe: {
        label: 'Sharpe',
        description: 'Risk-adjusted return: excess return per unit of volatility (vs 5% risk-free rate). Annualized.',
        direction: 'higher',
        directionNote: 'Higher is better. Above 1.0 is good; above 2.0 is excellent.',
    },
    sortino: {
        label: 'Sortino',
        description: 'Like Sharpe but only penalizes downside volatility — upside swings don\'t count against you.',
        direction: 'higher',
        directionNote: 'Higher is better. Above 1.5 is solid.',
    },
    drawdown: {
        label: 'Max Drawdown',
        description: 'Largest peak-to-trough decline over the period. Shows worst-case loss scenario.',
        direction: 'lower',
        directionNote: 'Lower (less negative) is better. Closer to 0% means smaller worst loss.',
    },
    volatility: {
        label: 'Volatility',
        description: 'Annualized standard deviation of daily returns. Measures how much the portfolio swings around.',
        direction: 'lower',
        directionNote: 'Lower is better for stability, but some volatility is normal for growth portfolios.',
    },
    trackingError: {
        label: 'Tracking Error',
        description: 'Annualized standard deviation of the return difference vs VTI. How much the portfolio strays from the market.',
        direction: 'lower',
        directionNote: 'Lower means closer to market. Higher means more idiosyncratic bets.',
    },
    infoRatio: {
        label: 'Information Ratio',
        description: 'Excess return over VTI divided by tracking error. Quality of active bets vs their cost in deviation.',
        direction: 'higher',
        directionNote: 'Higher is better. Above 0.5 is good; negative means you\'re taking tracking risk for no reward.',
    },
    upside: {
        label: 'Upside Capture',
        description: 'How much of VTI\'s gains you captured when the market was up. 90% = you got 90¢ for every $1 VTI gained.',
        direction: 'higher',
        directionNote: 'Higher is better. 100% = you match VTI in up markets.',
    },
    downside: {
        label: 'Downside Capture',
        description: 'How much of VTI\'s losses you experienced when the market was down. 80% = you lost 80¢ for every $1 VTI lost.',
        direction: 'lower',
        directionNote: 'Lower is better. 100% = you match VTI in down markets; <100% means better downside protection.',
    },
    m2Delta: {
        label: 'M2 Delta (Δ)',
        description: 'Modigliani-Modigliani Delta. The risk-adjusted excess return vs the benchmark. Normalizes the portfolio to benchmark volatility to show true efficiency gain or loss.',
        direction: 'higher',
        directionNote: 'Positive Δ means you out-performed on a risk-adjusted basis.',
    },
    volRatio: {
        label: 'Vol Ratio (Beta)',
        description: 'Portfolio volatility divided by benchmark volatility. Matches market at 1.0x; >1.0x indicates higher price swings.',
        direction: 'lower',
        directionNote: 'Lower ratio indicates a smoother, less volatile ride.',
    },
    alpha: {
        label: 'Jensen\'s Alpha',
        description: 'The excess return earned over the market-required return for the risk taken. Pure "active" performance premium.',
        direction: 'higher',
        directionNote: 'Higher is better. Positive alpha is the goal of strategic allocation.',
    },
    capture: {
        label: 'Capture Ratio (U/D)',
        description: 'Upside / Downside Capture. 110% Upside means you gained 10% more than the market in up periods. 90% Downside means you lost 10% less in down periods.',
        direction: 'neutral',
        directionNote: 'Measures how much rally you keep vs how much crash you avoid.',
    },
    annualLoss: {
        label: 'Annual $ Loss',
        description: 'The estimated dollar amount lost due to the performance gap (M2 Delta) vs the Target strategy.',
        direction: 'lower',
        directionNote: 'Lower is better. Represents the "Cost of Inaction" or suboptimal execution.',
    },
    efficiencyGap: {
        label: 'Efficiency Gap',
        description: 'The difference between your actual M2 and the Strategy\'s potential M2. Measures how much optimization is left on the table.',
        direction: 'lower',
        directionNote: 'Smaller gap means higher execution efficiency.',
    },
};

export default function MetricTooltip({ info }: { info: MetricInfo }) {
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        className="ml-1 text-zinc-600 hover:text-zinc-400 transition-colors text-xs leading-none"
                        aria-label={`${info.label} explanation`}
                    >
                        ⓘ
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="w-64">
                    <div className="ui-label text-white mb-1.5 border-b border-zinc-800 pb-1">{info.label}</div>
                    <div className="leading-relaxed mb-2 normal-case font-normal">{info.description}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${
                        info.direction === 'higher' ? 'text-emerald-400' :
                        info.direction === 'lower'  ? 'text-amber-400' :
                        'text-zinc-500'
                    }`}>
                        {info.directionNote}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
