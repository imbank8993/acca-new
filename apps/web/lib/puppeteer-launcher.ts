/**
 * lib/puppeteer-launcher.ts
 * Helper terpusat untuk melaunch Puppeteer dengan executablePath Chromium/Chrome
 * yang terdeteksi otomatis di sistem Linux (Docker/VPS) maupun dari env PUPPETEER_EXECUTABLE_PATH.
 */

import fs from 'fs';
import type { Browser } from 'puppeteer';

export function getPuppeteerExecutablePath(): string | undefined {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    if (envPath && fs.existsSync(envPath)) {
        return envPath;
    }
    
    const possiblePaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/snap/bin/chromium',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        (process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : ''),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter(Boolean);
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    
    return envPath || undefined;
}

export async function launchPuppeteerBrowser(extraArgs: string[] = []): Promise<Browser> {
    const puppeteer = (await import('puppeteer')).default;
    const executablePath = getPuppeteerExecutablePath();
    
    const args = Array.from(new Set([
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
        ...extraArgs,
    ]));

    return await puppeteer.launch({
        headless: true,
        executablePath,
        args,
    });
}
