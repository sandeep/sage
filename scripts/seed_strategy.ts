
import db from '../src/lib/db/client';

const STRATEGY = {
  "Stock": {
    "weight": 0.98,
    "categories": {
      "US Stock": {
        "weight": 0.68,
        "subcategories": {
          "US Large Cap/SP500/DJIX": { "weight": 0.20, "expected_return": 0.075 },
          "Total Stock Market": { "weight": 0.20, "expected_return": 0.08 },
          "Small Cap Value": { "weight": 0.10, "expected_return": 0.105 },
          "Non Big (Ext Market/Small Blend)": { "weight": 0.05, "expected_return": 0.09 },
          "REIT": { "weight": 0.08, "expected_return": 0.085 },
          "Healthcare": { "weight": 0.05, "expected_return": 0.07 }
        }
      },
      "Intl'l Stock": {
        "weight": 0.30,
        "subcategories": {
          "Emerging Market": { "weight": 0.15, "expected_return": 0.095 },
          "Developed Market": { "weight": 0.15, "expected_return": 0.075 }
        }
      }
    }
  },
  "Bond": {
    "weight": 0.02,
    "categories": {
      "US Aggregate Bond": { "weight": 0.02, "expected_return": 0.045 }
    }
  },
  "Cash": {
    "weight": 0.00,
    "expected_return": 0.02
  }
};

function seed() {
    console.log("Seeding Strategic Target Hierarchy...");
    db.transaction(() => {
        db.prepare("DELETE FROM allocation_nodes").run();
        
        function walk(label: string, node: any, parent: string | null, level: number) {
            db.prepare(`
                INSERT INTO allocation_nodes (label, parent_label, weight, expected_return, level)
                VALUES (?, ?, ?, ?, ?)
            `).run(label, parent, node.weight, node.expected_return || null, level);

            if (node.categories) {
                Object.entries(node.categories).forEach(([l, d]) => walk(l, d, label, level + 1));
            }
            if (node.subcategories) {
                Object.entries(node.subcategories).forEach(([l, d]) => walk(l, d, label, level + 1));
            }
        }

        Object.entries(STRATEGY).forEach(([label, node]) => walk(label, node, null, 0));
    })();
    console.log("✅ Strategy Seeded.");
}

seed();
