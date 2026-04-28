
import fs from 'fs';
import path from 'path';

const csvPath = path.join(process.cwd(), 'simba_full_dump.csv');
const outputPath = path.join(process.cwd(), 'src/lib/data/simba_returns.json');

const csvData = fs.readFileSync(csvPath, 'utf8');
const lines = csvData.split('\n');

const ASSET_CLASS_MAP: Record<number, string> = {
    1: "TSM",
    2: "INTL",
    3: "ITT",
    6: "LCB",
    11: "SCV",
    17: "EM",
    29: "REIT"
};

const result: any = {
    source: "Backtest-Portfolio-returns-rev25b.xlsx (Nominal Block Extract)",
    updated: new Date().toISOString().split('T')[0],
    asset_classes: {
        TSM: { label: "Total Stock Market", returns: {} },
        INTL: { label: "Total Int'l Stock", returns: {} },
        ITT: { label: "Intermediate Term Treasury", returns: {} },
        LCB: { label: "US Large Cap / SP500", returns: {} },
        SCV: { label: "Small Cap Value", returns: {} },
        EM: { label: "Emerging Market", returns: {} },
        REIT: { label: "REIT", returns: {} },
        VTI: { label: "VTI Benchmark", returns: {} },
        Cash: { label: "Cash", returns: {} }
    }
};

let inNominalBlock = false;
const foundYears = new Set<string>();

for (const line of lines) {
    const parts = line.split(',');
    
    // Detect start of Nominal returns block
    if (line.includes("Nominal returns")) {
        inNominalBlock = true;
        continue;
    }

    if (!inNominalBlock) continue;

    const yearStr = parts[0]?.trim();
    const year = parseInt(yearStr);
    
    // Stop if we hit a non-year line or a year we've already processed
    if (isNaN(year) || year < 1871 || year > 2025 || foundYears.has(yearStr)) {
        if (foundYears.size > 0) break; // Finished the block
        continue;
    }

    foundYears.add(yearStr);

    Object.entries(ASSET_CLASS_MAP).forEach(([idx, key]) => {
        const val = parseFloat(parts[parseInt(idx)]);
        if (!isNaN(val)) {
            const decimal = val / 100;
            result.asset_classes[key].returns[yearStr] = decimal;
            if (key === "TSM") {
                result.asset_classes.VTI.returns[yearStr] = decimal;
            }
        }
    });
}

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log("Nominal Simba data written to src/lib/data/simba_returns.json");
console.log("Years covered:", foundYears.size);
const sample2023 = result.asset_classes.TSM.returns["2023"];
console.log("Sample 2023 TSM Return (Expected ~26%):", (sample2023 * 100).toFixed(2) + "%");
