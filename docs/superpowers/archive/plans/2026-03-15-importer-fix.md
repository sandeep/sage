# Importer & UI Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Fix the Account Mapping tax strategy bug, add a Parser Audit view, remove live system slop, and ensure the Sankey chart renders correctly for debugging the importer.

**Architecture:** We will surgically update the React components to properly bind the `tax_character` state, inject the debug UI table to show skipped rows, and strip out unnecessary "System Live" decorative elements to meet the user's aesthetic and functional demands.

**Tech Stack:** Next.js, React, SQLite, Tailwind CSS.

---

## Chunk 1: Fix Account Mapping Tax Strategy

**Goal:** Ensure bootstrapped accounts show the correct tax strategy by falling back correctly.

**Files:**
- Modify: `src/app/components/AccountMapper.tsx`

- [x] **Step 1: Fix the `ACCOUNT_CONFIGS` matching logic**

In `AccountMapper.tsx`, `account_type` is likely null from bootstrap, so we should match by `tax_character` as a fallback or initialize `account_type`.

Find:
```tsx
const currentConfig = ACCOUNT_CONFIGS.find(c => c.type === acc.account_type) || ACCOUNT_CONFIGS[2];
```
Replace with:
```tsx
const currentConfig = ACCOUNT_CONFIGS.find(c => c.type === acc.account_type || c.character === acc.tax_character) || ACCOUNT_CONFIGS[2];
```

## Chunk 2: Add Parser Audit UI

**Goal:** Surface the skipped rows array in the UI so the user can debug the parser.

**Files:**
- Modify: `src/app/accounts/page.tsx`

- [x] **Step 1: Inject the Parser Audit table under the Sankey chart** (implemented in MainImporter.tsx)

Find:
```tsx
                        <SankeyChart nodes={uploadResult.sankey.nodes} links={uploadResult.sankey.links} />
                    </section>
```
Replace with:
```tsx
                        <SankeyChart nodes={uploadResult.sankey.nodes} links={uploadResult.sankey.links} />

                        {uploadResult.skipped.length > 0 && (
                            <div className="space-y-4 pt-8 border-t border-zinc-900">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 px-1">Parser Audit — Skipped Rows</h3>
                                <div className="border border-zinc-900 rounded-sm overflow-hidden bg-zinc-950/30">
                                    <table className="w-full text-left border-collapse text-[10px] font-mono">
                                        <thead>
                                            <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-500 uppercase tracking-widest">
                                                <th className="px-4 py-2 w-1/4">Reason</th>
                                                <th className="px-4 py-2">Raw Line</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-900/50">
                                            {uploadResult.skipped.map((s, i) => (
                                                <tr key={i} className="hover:bg-zinc-900/20 transition-colors">
                                                    <td className="px-4 py-2 text-rose-900 font-bold uppercase">{s.reason}</td>
                                                    <td className="px-4 py-2 text-zinc-700 truncate max-w-xl">{s.line}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
```

## Chunk 3: Remove "System Live" Slop & Update Nav

**Goal:** Clean up the UI aesthetics and terminology.

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/components/AccountMapper.tsx`

- [x] **Step 1: Update Navigation & Remove Live indicator in `page.tsx`**

Find:
```tsx
            <Link 
              href="/audit" 
              className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all rounded-sm"
            >
              Strategic Audit &rarr;
            </Link>
```
Replace with:
```tsx
            <Link 
              href="/audit" 
              className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all rounded-sm"
            >
              Performance &rarr;
            </Link>
```

Find & Remove:
```tsx
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              System Live
            </div>
```

- [x] **Step 2: Remove Database Connected indicator in `AccountMapper.tsx`**

Find:
```tsx
            <div className="bg-zinc-900/50 p-8 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Account Configuration</h2>
                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">[DATABASE_CONNECTED]</span>
            </div>
```
Replace with:
```tsx
            <div className="bg-zinc-900/50 p-8 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Account Configuration</h2>
            </div>
```
