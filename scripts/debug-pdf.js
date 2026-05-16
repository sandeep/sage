const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function test() {
    try {
        const filePath = path.join(__dirname, '../Statements/RH0022379349.pdf');
        console.log(`Reading ${filePath}...`);
        const buffer = fs.readFileSync(filePath);
        
        console.log('Parsing PDF...');
        const data = await pdf(buffer);
        console.log('Success! Text length:', data.text.length);
    } catch (e) {
        console.error('FAILED TO PARSE:', e);
    }
}

test();
