const pdfModule = require('pdf-parse');
const fs = require('fs');

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node parse-pdf.js <file-path>');
        process.exit(1);
    }

    try {
        const buffer = fs.readFileSync(filePath);
        const parser = new pdfModule.PDFParse({ data: buffer });
        const result = await parser.getText();
        process.stdout.write(result.text || '');
    } catch (e) {
        console.error('PARSE_ERROR:', e.message);
        process.exit(1);
    }
}

main();
