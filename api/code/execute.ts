/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Vercel Serverless Endpoint for Multi-Language Code Execution (/api/code/execute)
 */

import { runCodeLocallySync } from '../../src/utils/codeExecutionEngine';
import type { CodingLanguage } from '../../src/types';

const PISTON_LANGUAGE_MAP: Record<CodingLanguage, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
  javascript: { language: 'javascript', version: '18.15.0' },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { language, sourceCode, stdin = '' } = req.body || {};
    if (!language || typeof sourceCode !== 'string') {
      return res.status(400).json({ handled: false, error: 'Missing language or sourceCode' });
    }

    const startMs = Date.now();
    const pistonMeta = PISTON_LANGUAGE_MAP[language as CodingLanguage];

    // 1. Try remote container sandbox first with 3.5s timeout
    if (pistonMeta && typeof fetch !== 'undefined') {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const pistonRes = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: pistonMeta.language,
            version: pistonMeta.version,
            files: [
              {
                name: language === 'java' ? 'Main.java' : `main.${language}`,
                content: sourceCode,
              },
            ],
            stdin,
            run_timeout: 2000,
            compile_timeout: 5000,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (pistonRes.ok) {
          const pistonData = await pistonRes.json();
          if (pistonData?.compile && pistonData.compile.code !== 0) {
            return res.status(200).json({
              handled: true,
              status: 'CE',
              stdout: pistonData.compile.stdout || '',
              stderr: pistonData.compile.stderr || pistonData.compile.output || 'Compilation Error',
              executionTimeMs: Date.now() - startMs,
            });
          }
          if (pistonData?.run) {
            const isTle = pistonData.run.signal === 'SIGKILL';
            const isRuntimeErr = pistonData.run.code !== 0 && !isTle;
            return res.status(200).json({
              handled: true,
              status: isTle ? 'TLE' : isRuntimeErr ? 'RE' : 'AC',
              stdout: pistonData.run.stdout || '',
              stderr: pistonData.run.stderr || '',
              executionTimeMs: Date.now() - startMs,
            });
          }
        }
      } catch {
        // Fallback to built-in deterministic execution engine below
      }
    }

    // 2. Built-in deterministic multi-language execution fallback
    const localExec = runCodeLocallySync(language as CodingLanguage, sourceCode, stdin);
    return res.status(200).json({
      handled: true,
      ...localExec,
    });
  } catch (err: any) {
    return res.status(200).json({
      handled: false,
      error: err?.message || 'Execution error',
    });
  }
}
