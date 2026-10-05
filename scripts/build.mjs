import { access, readFile } from 'node:fs/promises';
for(const file of ['public/index.html','public/app.js','public/core.js','public/styles.css','public/data/hockey.json','public/data/daily-puzzles.json']) await access(file);
const data=JSON.parse(await readFile('public/data/hockey.json','utf8'));
if(!data.puzzles.length||!Object.keys(data.players).length) throw Error('Missing hockey data');
console.log(`Ready: ${Object.keys(data.players).length.toLocaleString()} players, ${data.puzzles.length} daily challenges.`);
