#!/usr/bin/env node

/**
 * Convert all remaining CommonJS files to ES modules
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const filesToConvert = [
    'src/services/continuousSync.js',
    'src/integrations/craft-advanced.js',
    'src/integrations/craft.js',
    'src/integrations/llm.js',
    'src/integrations/github.js',
    'src/agents/updater.js',
    'src/agents/analyzer.js',
    'src/routes/webhook.js',
    'src/utils/outputGenerator.js',
];

function convertFile(filePath) {
    let content = readFileSync(filePath, 'utf-8');

    // Replace require statements
    content = content.replace(/const (\w+) = require\('(.+?)'\);/g, "import $1 from '$2.js';");
    content = content.replace(/const { (.+?) } = require\('(.+?)'\);/g, "import { $1 } from '$2.js';");

    // Fix local imports (add .js extension if not present)
    content = content.replace(/from '(\.\.?\/.+?)'/g, (match, path) => {
        if (!path.endsWith('.js') && !path.includes('node_modules')) {
            return `from '${path}.js'`;
        }
        return match;
    });

    // Replace module.exports
    content = content.replace(/module\.exports = (\w+);/, 'export default $1;');

    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Converted: ${filePath}`);
}

console.log('Converting CommonJS to ES modules...\n');

for (const file of filesToConvert) {
    const fullPath = join(process.cwd(), file);
    try {
        convertFile(fullPath);
    } catch (error) {
        console.error(`❌ Failed to convert ${file}:`, error.message);
    }
}

console.log('\n✅ All files converted!');
