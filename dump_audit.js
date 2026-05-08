const { generateAuditReport } = require('./dist/lib/logic/auditEngine');
generateAuditReport().then(r => {
    console.log("ACTUAL:", r.coordinates.actual.return * 100, "%");
    console.log("TARGET:", r.coordinates.target.return * 100, "%");
    console.log("VTI:", r.coordinates.vti.return * 100, "%");
    console.log("\nFRONTIER POINTS (Local):");
    r.frontierPoints.points.slice(0, 5).forEach(p => console.log(p.vol*100, "% ->", p.return*100, "%"));
    console.log("...");
    r.frontierPoints.points.slice(-5).forEach(p => console.log(p.vol*100, "% ->", p.return*100, "%"));
}).catch(console.error);
