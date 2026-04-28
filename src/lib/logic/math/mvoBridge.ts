import { spawn } from 'child_process';
import path from 'path';

/**
 * Interface for the return data structure from the Python script.
 */
export interface MVOPoint {
  vol: number;
  return: number;
  isCurve: boolean;
}

export interface MVOResponse {
  points: MVOPoint[];
  cloud: MVOPoint[];
}

/**
 * The TypeScript Bridge for the Markowitz Efficient Frontier.
 * This service pipes return data to the Python script and parses the resulting JSON.
 *
 * @param returns - A record of asset names and their return arrays.
 * @returns A promise that resolves to the efficient frontier points and opportunity cloud.
 */
export async function solveEfficientFrontier(
  returns: Record<string, number[]>
): Promise<MVOResponse> {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scriptPath = path.join(process.cwd(), 'src/lib/logic/math/optimizer.py');

    const pythonProcess = spawn(pythonPath, [scriptPath]);

    let stdoutData = '';
    let stderrData = '';

    // Pipe JSON input to the Python process
    pythonProcess.stdin.write(JSON.stringify({ returns }));
    pythonProcess.stdin.end();

    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Handle process close
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        let errorMessage = `Python process exited with code ${code}`;
        if (stderrData) {
          try {
            const errorJson = JSON.parse(stderrData);
            errorMessage = errorJson.error || stderrData;
          } catch {
            errorMessage = stderrData;
          }
        }
        return reject(new Error(errorMessage));
      }

      try {
        const response: MVOResponse = JSON.parse(stdoutData);
        resolve(response);
      } catch (err) {
        reject(new Error(`Failed to parse Python output: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    // Handle process spawn errors
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}
