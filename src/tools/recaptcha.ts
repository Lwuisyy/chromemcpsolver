/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {zod} from '../third_party/index.js';
import type {Context} from './ToolDefinition.js';
import {ToolCategory} from './categories.js';
import {defineTool} from './ToolDefinition.js';
import type {Response} from './ToolDefinition.js';
import {execFile} from 'child_process';
import {promisify} from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

// Helper to find python executable
async function getPythonExecutable() {
  try {
    await execFileAsync('python', ['--version']);
    return 'python';
  } catch (e) {
    try {
      await execFileAsync('python3', ['--version']);
      return 'python3';
    } catch (e2) {
      // Fallback for Windows if python is not in PATH but exists in standard location
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        const pythonDir = path.join(localAppData, 'Programs', 'Python');
        if (fs.existsSync(pythonDir)) {
          const versions = fs.readdirSync(pythonDir).filter(d => d.startsWith('Python'));
          if (versions.length > 0) {
            const pythonExe = path.join(pythonDir, versions[versions.length - 1], 'python.exe');
            if (fs.existsSync(pythonExe)) {
              return pythonExe;
            }
          }
        }
      }
      throw new Error('Python executable not found. Please install Python and ensure it is in your PATH.');
    }
  }
}

// Helper to find solve-audio.py
function getSolveAudioScriptPath() {
  // We need to walk up from __dirname until we find solve-audio.py
  // In dev it's in root/src/tools/recaptcha.ts -> root/solve-audio.py
  // In dist it's in root/dist/src/tools/recaptcha.js -> root/solve-audio.py
  
  let currentDir = __dirname;
  while (currentDir !== path.parse(currentDir).root) {
    const scriptPath = path.join(currentDir, 'solve-audio.py');
    if (fs.existsSync(scriptPath)) {
      return scriptPath;
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error('Could not locate solve-audio.py script.');
}

export const solve_recaptcha = defineTool({
  name: 'solve_recaptcha',
  description:
    'Solves an audio reCAPTCHA on the active page using the Buster (Wit.ai) method. Switches to audio challenge, downloads the audio, sends it to STT API, and submits the result.',
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  blockedByDialog: false,
  verifyFilesSchema: [],
  schema: {
    pageId: zod.number().optional().describe('The ID of the page where the reCAPTCHA is. Leave empty to use the active page.'),
  },
  handler: async (
    request: {params: {pageId?: number}},
    response: Response,
    context: Context
  ): Promise<void> => {
    const page = request.params.pageId ? context.getPageById(request.params.pageId).pptrPage : context.getSelectedMcpPage().pptrPage;

    
    // Find the reCAPTCHA iframes
    let checkboxFrame = null;
    let bframe = null; // The frame containing the popup challenge
    
    for (const frame of page.frames()) {
      const url = frame.url();
      if (url.includes('api2/anchor')) {
        checkboxFrame = frame;
      } else if (url.includes('api2/bframe')) {
        bframe = frame;
      }
    }

    if (!checkboxFrame && !bframe) {
      throw new Error('reCAPTCHA iframes not found on the page.');
    }

    try {
      // 0. Click the checkbox first if we are not already in the challenge
      if (checkboxFrame) {
        try {
          const checkboxBtn = await checkboxFrame.waitForSelector('#recaptcha-anchor', {timeout: 2000});
          if (checkboxBtn) {
            await checkboxBtn.click();
            // Wait a bit for the challenge popup to appear
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (e) {
          // It might already be open or the selector is different
        }
      }

      // Re-evaluate frames in case bframe just loaded
      for (const frame of page.frames()) {
        const url = frame.url();
        if (url.includes('api2/bframe')) {
          bframe = frame;
        }
      }

      if (!bframe) {
         throw new Error('reCAPTCHA challenge iframe (bframe) not found after clicking checkbox.');
      }

      // 1. Click Audio Button
      const audioBtn = await bframe.waitForSelector('#recaptcha-audio-button', {timeout: 5000});
      await audioBtn?.click();

      // Wait a bit for the audio challenge to load
      await new Promise(r => setTimeout(r, 1000));

      // 2. Wait for download link and get URL
      const downloadLink = await bframe.waitForSelector('.rc-audiochallenge-tdownload-link', {timeout: 5000});
      const audioUrl = await downloadLink?.evaluate(el => (el as HTMLAnchorElement).href);

      if (!audioUrl) {
         throw new Error('Could not extract audio URL.');
      }

      // 3. Delegate to Python script for Google STT (bypassing Wit.ai CORS/Quota limits)
      const pythonExe = await getPythonExecutable();
      const scriptPath = getSolveAudioScriptPath();
      
      const {stdout, stderr} = await execFileAsync(pythonExe, [scriptPath, audioUrl]);
      
      let transcript = '';
      for (const line of stdout.split('\n')) {
          if (line.startsWith('TRANSCRIPT:')) {
              transcript = line.replace('TRANSCRIPT:', '').trim();
              break;
          }
      }

      if (!transcript) {
         throw new Error(`Failed to transcribe audio. Output: ${stdout} | Error: ${stderr}`);
      }

      // 5. Fill transcript and verify
      const inputField = await bframe.waitForSelector('#audio-response', {timeout: 5000});
      await inputField?.type(transcript);

      const verifyBtn = await bframe.waitForSelector('#recaptcha-verify-button', {timeout: 5000});
      await verifyBtn?.click();

      // Wait a moment to see if it was successful (or if it asked for multiple)
      await new Promise(r => setTimeout(r, 2000));

      response.appendResponseLine(`Successfully submitted reCAPTCHA with transcript: "${transcript}"`);

    } catch (e: any) {
      throw e;
    }
  },
});
