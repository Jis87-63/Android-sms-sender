import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const paths = Object.freeze({ root, contacts:path.join(root,'contacts'), messages:path.join(root,'messages'), blacklist:path.join(root,'blacklist','blacklist.txt'), reports:path.join(root,'reports'), config:path.join(root,'config','config.local.json'), configExample:path.join(root,'config','config.example.json') });
