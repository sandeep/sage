import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Parses a PDF file using an isolated Node.js process to bypass 
 * Next.js/Turbopack environment conflicts with native PDF engines.
 */
export async function parsePdfIsolated(buffer: Buffer): Promise<string> {
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const tempFile = path.join(tempDir, `parse_${Date.now()}.pdf`);
    const scriptPath = path.join(process.cwd(), 'scripts/parse-pdf.js');
    
    try {
        // Write buffer to a temporary file
        fs.writeFileSync(tempFile, buffer);
        
        // Execute the isolated parser script
        const { stdout, stderr } = await execPromise(`node "${scriptPath}" "${tempFile}"`);
        
        if (stderr && !stdout) {
            throw new Error(`Isolated Parse Error: ${stderr}`);
        }
        
        return stdout;
    } finally {
        // Cleanup temp file
        if (fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile); } catch (e) {}
        }
    }
}
