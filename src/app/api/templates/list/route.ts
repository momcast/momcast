import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const templatesDir = path.join(process.cwd(), 'public', 'templates');

        if (!fs.existsSync(templatesDir)) {
            return NextResponse.json([]);
        }

        const files = fs.readdirSync(templatesDir);
        const templateFiles = files
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                id: file.replace('.json', ''),
                name: file.replace('.json', '').replace(/_/g, ' ').toUpperCase(),
                path: `/templates/${file}`
            }));

        return NextResponse.json(templateFiles);
    } catch (error) {
        console.error('Failed to list templates:', error);
        return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
    }
}
