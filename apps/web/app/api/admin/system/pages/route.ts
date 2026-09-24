import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const appDir = path.join(process.cwd(), 'app');
        const items = fs.readdirSync(appDir);

        // Filter out non-page folders and technical files
        const exclude = ['api', 'components', 'lib', 'login', 'favicon.ico', 'globals.css', 'layout.tsx', 'page.tsx'];

        const pageFolders = items.filter(item => {
            const fullPath = path.join(appDir, item);
            return fs.statSync(fullPath).isDirectory() && !exclude.includes(item);
        });

        // Format for dropdown: capitalize and replace hyphens with spaces
        const pages = pageFolders.map(folder => {
            const label = folder
                .split(/[-_]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            return {
                value: label, // Using the label as value to maintain compatibility with existing string-based storage
                label: label,
                folder: folder
            };
        });

        // Sort alphabetically
        pages.sort((a, b) => a.label.localeCompare(b.label));

        return NextResponse.json({ ok: true, data: pages });
    } catch (error: any) {
        console.error('Error scanning pages:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
