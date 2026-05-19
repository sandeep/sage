const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function main() {
    const buffer = fs.readFileSync('Statements/RH0022379349.pdf');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const lines = result.text.split('\n');
    
    let summary = false;
    for (const line of lines) {
        if (line.includes('TRADE CONFIRMATION SUMMARY')) summary = true;
        if (summary && line.includes('JOURNAL ENTRIES')) summary = false;
        
        if (summary) {
            console.log(line);
        }
    }
}
main();
