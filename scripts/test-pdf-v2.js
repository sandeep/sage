const pdfModule = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function test() {
    try {
        const buffer = fs.readFileSync(path.join(__dirname, '../Statements/RH0022379349.pdf'));
        console.log('Module keys:', Object.keys(pdfModule));
        
        // Try strategy 1: new PDFParse
        console.log('Testing PDFParse class...');
        try {
            const parser = new pdfModule.PDFParse({ data: buffer });
            console.log('Instance created');
            const data = await parser.getText();
            console.log('Success! Text length:', data.text.length);
        } catch (e) {
            console.error('PDFParse class failed:', e.message);
        }
        
        // Try strategy 2: exported function
        console.log('Testing default export function...');
        const pdf = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
        if (typeof pdf === 'function') {
            const data = await pdf(buffer);
            console.log('Success! Text length:', data.text.length);
        } else {
            console.log('No function found');
        }
    } catch (e) {
        console.error('TEST FAILED:', e);
    }
}

test();
