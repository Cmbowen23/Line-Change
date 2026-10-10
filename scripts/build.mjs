import { access, readFile } from 'node:fs/promises';
for(const file of ['public/fonts/bungee-regular.woff','public/fonts/barlow-regular.woff','public/fonts/barlow-semibold.woff','public/fonts/Bungee-OFL.txt','public/fonts/Barlow-OFL.txt','public/index.html','public/app.js','public/core.js','public/modes.js','public/snake.js','public/solver-worker.js','public/lookup.js','public/explore.js','public/challenges.js','public/presentation.js','public/styles.css','public/data/player-depth.json','public/data/hockey.json','public/data/daily-puzzles.json']) await access(file);
const data=JSON.parse(await readFile('public/data/hockey.json','utf8'));
if(!data.puzzles.length||!Object.keys(data.players).length) throw Error('Missing hockey data');
console.log(`Ready: ${Object.keys(data.players).length.toLocaleString()} players, ${data.puzzles.length} daily challenges.`);

for(const file of ['index.html','app.js','core.js','modes.js','snake.js','solver-worker.js','lookup.js','explore.js','challenges.js','presentation.js','styles.css','favicon.svg','data/baseball.json','data/daily-puzzles.json','data/player-depth.json'])await access('public/baseball/'+file);
await access('public/sports.css');
const baseball=JSON.parse(await readFile('public/baseball/data/baseball.json','utf8'));
if(baseball.sport!=='MLB'||!baseball.puzzles.length||Object.keys(baseball.players).length<10000)throw Error('Missing baseball data');
console.log(`Baseball ready: ${Object.keys(baseball.players).length.toLocaleString()} players, ${baseball.puzzles.length} daily challenges.`);
