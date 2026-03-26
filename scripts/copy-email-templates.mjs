import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('src/infrastructure/email/templates');
const destinationDir = path.resolve('dist/infrastructure/email/templates');

if (!fs.existsSync(sourceDir)) {
    process.exit(0);
}

fs.mkdirSync(destinationDir, { recursive: true });

for (const entry of fs.readdirSync(sourceDir)) {
    const sourceFile = path.join(sourceDir, entry);
    const destinationFile = path.join(destinationDir, entry);
    fs.copyFileSync(sourceFile, destinationFile);
}
