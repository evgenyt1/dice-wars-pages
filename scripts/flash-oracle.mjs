#!/usr/bin/env node
// Research only. Execute the numeric AS2 classes exported from the pinned SWF
// in an isolated JS context. This is NOT a Flash runtime or production code.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const [exportDirectory, outputDirectory] = process.argv.slice(2);
if (!exportDirectory || !outputDirectory) {
  throw new Error('Usage: node scripts/flash-oracle.mjs <FFDec AS export directory> <output directory>');
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
// Keep numeric arrays and outline points compact while retaining reviewable
// territory/fixture boundaries in the permanent JSON evidence.
function evidenceJson(value, depth = 0) {
  const primitive = item => item === null || typeof item !== 'object';
  const smallRecord = item => !Array.isArray(item) && item !== null && typeof item === 'object' &&
    Object.keys(item).length <= 3 && Object.values(item).every(primitive);
  if (primitive(value)) return JSON.stringify(value);
  if (Array.isArray(value) && value.every(item => primitive(item) || smallRecord(item))) return JSON.stringify(value);
  const padding = '  '.repeat(depth);
  const next = `${padding}  `;
  if (Array.isArray(value)) return `[\n${value.map(item => next + evidenceJson(item, depth + 1)).join(',\n')}\n${padding}]`;
  return `{\n${Object.entries(value).map(([key, item]) => next + JSON.stringify(key) + ': ' + evidenceJson(item, depth + 1)).join(',\n')}\n${padding}}`;
}
const manifest = JSON.parse(await readFile(new URL('../docs/flash-reference/manifest.json', import.meta.url), 'utf8'));
const sourceHashes = {};
const classNames = ['AreaData', 'PlayerData', 'JoinData', 'HistoryData', 'Game'];
const classes = await Promise.all(classNames.map(async (name) => {
  const relative = `scripts/__Packages/dw/${name}.as`;
  const source = await readFile(path.join(exportDirectory, relative), 'utf8');
  sourceHashes[relative] = hash(source);
  if (sourceHashes[relative] !== manifest.scriptSha256[relative]) {
    throw new Error(`Unverified AS2 export: ${relative}. Regenerate it from the pinned SWF with audit-flash.py.`);
  }
  return source.replace(/\r/g, '')
    .replace(`class dw.${name}`, `dw.${name} = class ${name}`)
    .replace(/^   var (\w+)([^;]*);$/gm, '   $1$2;')
    .replace(new RegExp(`   function ${name}\\(`), '   constructor(')
    .replace(/^   function (\w+)\(/gm, '   $1(');
}));
const enginePath = path.resolve('app/game-engine.ts');
const engineSource = await readFile(enginePath, 'utf8');
const compiledEngine = ts.transpileModule(engineSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rngSource = `
let rngState = SEED >>> 0;
let rngCalls = 0;
Math.random = () => {
  rngCalls++;
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
  return rngState / 4294967296;
};
`;

function original(seed, count) {
  const context = vm.createContext({ SEED: seed });
  vm.runInContext(`${rngSource}\nconst dw = {};\n${classes.join('\n')}\nconst game = new dw.Game(); game.pmax = ${count}; game.make_map(); game.start_game();`, context, { timeout: 5000 });
  return context;
}
function current(seed, count) {
  const context = vm.createContext({ SEED: seed, exports: {} });
  vm.runInContext(`${rngSource}\n${compiledEngine}\nconst game = exports.createGame(${count});`, context, { timeout: 5000 });
  return context;
}
const read = (context, expression) => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context, { timeout: 5000 }));
const originalState = (context) => read(context, `({
  playerCount:game.pmax, cells:game.cel,
  territories:game.adat.map((a,id)=>({id,size:a.size,owner:a.arm,dice:a.dice,centerCell:a.cpos,
    neighbors:a.join.map((v,i)=>v && i>0 ? i : -1).filter(i=>i>=0),
    outline:a.line_cel.map((cell,i)=>({cell,direction:a.line_dir[i]})).filter(a=>a.cell!==undefined)})),
  turnOrder:game.jun.slice(0,game.pmax), rngCalls
})`);
const currentState = (context) => read(context, `({
  playerCount:game.playerCount,cells:game.cellTerritory,
  territories:game.territories.map(a=>({...a,neighbors:[...a.neighbors].sort((a,b)=>a-b)})),
  turnOrder:game.turnOrder,rngCalls
})`);

const differences = { cells: 0, owners: 0, dice: 0, centers: 0, adjacency: 0, turnOrder: 0, rngCalls: 0 };
const cases = [];
const fixtures = [];
for (let count = 2; count <= 8; count++) {
  for (let seed = 1; seed <= 10; seed++) {
    const a = originalState(original(seed, count));
    const b = currentState(current(seed, count));
    const compare = (key, left, right) => {
      const different = JSON.stringify(left) !== JSON.stringify(right);
      if (different) differences[key]++;
      return different;
    };
    const live = a.territories.filter(t => t.size > 0);
    if (live.some((t, i) => t.owner !== i % count)) throw new Error('Original owner-order assumption failed.');
    if (live.some(t => t.dice < 1 || t.dice > 8)) throw new Error('Original dice bounds failed.');
    const record = { playerCount: count, seed, originalLiveTerritories: live.length, differences: {} };
    record.differences.cells = compare('cells', a.cells, b.cells);
    for (const [key, field] of [['owners', 'owner'], ['dice', 'dice'], ['centers', 'centerCell'], ['adjacency', 'neighbors']]) {
      record.differences[key] = compare(key, live.map(t => t[field]), live.map(t => b.territories[t.id][field]));
    }
    record.differences.turnOrder = compare('turnOrder', a.turnOrder, b.turnOrder);
    record.differences.rngCalls = compare('rngCalls', a.rngCalls, b.rngCalls);
    cases.push(record);
    if (seed === 1) fixtures.push({ seed, ...a });
  }
}

// Demonstrate that rerolls reuse the original priority array (constructor runs once).
const rerollContext = original(17, 7);
const priorityBefore = read(rerollContext, 'game.num');
vm.runInContext('game.make_map();', rerollContext, { timeout: 5000 });
const reroll = { seed: 17, playerCount: 7, priorityBefore: hash(JSON.stringify(priorityBefore)), secondMap: originalState(rerollContext) };

function aiProbe(name, areas, player, randomValues, expectedMove, expectedCalls, expectedRank) {
  const context = original(1, Math.max(...areas.map(a => a.owner)) + 1);
  vm.runInContext(`
    game.adat=Array.from({length:32},()=>new dw.AreaData());
    for(const a of ${JSON.stringify(areas)}) {
      Object.assign(game.adat[a.id],{size:6,arm:a.owner,dice:a.dice});
      for(const neighbor of a.neighbors??[])game.adat[a.id].join[neighbor]=1;
    }
    game.jun=Array.from({length:8},(_,i)=>i);game.ban=${player};
    const randomValues=${JSON.stringify(randomValues)};let probeCalls=0;
    Math.random=()=>{if(probeCalls>=randomValues.length)throw new Error('Unexpected RNG draw');return randomValues[probeCalls++];};
    const choice=game.com_thinking();
  `, context, { timeout: 1000 });
  const result = read(context, '({move:choice===0?null:[game.area_from,game.area_to],calls:probeCalls,rank:game.player.map(p=>p.dice_jun)})');
  if (JSON.stringify(result.move) !== JSON.stringify(expectedMove) || result.calls !== expectedCalls ||
      (expectedRank && JSON.stringify(result.rank) !== JSON.stringify(expectedRank))) {
    throw new Error(`${name}: unexpected original AI result ${JSON.stringify(result)}`);
  }
  return { name, areas, currentPlayer: player, randomValues, ...result };
}
const bypass = [{id:1,owner:0,dice:2,neighbors:[2,3]},{id:2,owner:1,dice:2},{id:3,owner:2,dice:1}];
const equal = [{id:1,owner:1,dice:2,neighbors:[2]},{id:2,owner:2,dice:2},{id:3,owner:0,dice:2}];
const aiProbes = [
  aiProbe('Rank bypass still consumes equal-dice RNG; uniform choice can pick lower advantage', bypass, 0, [0,0], [1,2], 2),
  aiProbe('Uniform choice can pick the last candidate', bypass, 0, [0,0.999999], [1,3], 2),
  aiProbe('Non-bypass equal gate rejects exactly 0.1', equal, 1, [0.1], null, 1),
  aiProbe('Non-bypass equal gate accepts above 0.1', equal, 1, [0.100001,0], [1,2], 2),
  aiProbe('Dominant-player focus excludes the easier other enemy', [
    {id:1,owner:0,dice:4,neighbors:[2,3]},{id:2,owner:1,dice:2},{id:3,owner:2,dice:1},{id:4,owner:1,dice:4},
  ], 0, [0], [1,2], 1),
  aiProbe('dice_jun is not a conventional rank', [
    {id:1,owner:0,dice:2},{id:2,owner:1,dice:1},{id:3,owner:2,dice:4},{id:4,owner:3,dice:3},
  ], 0, [], null, 0, [3,2,1,0,4,5,6,7]),
];

// Exercise the ORIGINAL AI chooser. Combat/supply here are a minimal harness
// of the separately audited timeline rules, not a playback/AVM1 equivalence claim.
const simulations = [];
for (let count = 2; count <= 8; count++) {
  for (let seed = 1; seed <= 3; seed++) {
    const context = original(seed, count);
    const result = vm.runInContext(`(() => {
      let turns=0, battles=0, supplied=0, humanEliminatedAt=null;
      while (turns < 20000) {
        const living=()=>Array.from({length:game.pmax},(_,i)=>i).filter(i=>game.player[i].area_tc>0);
        if (living().length===1) return {turns,battles,supplied,winner:living()[0],humanEliminatedAt};
        const pn=game.get_pn();
        for (let guard=0;guard<10000;guard++) {
          if (game.com_thinking()===0) break;
          const a=game.adat[game.area_from], b=game.adat[game.area_to];
          const old=b.arm;
          let sa=0,sb=0;
          for(let i=0;i<a.dice;i++)sa+=1+Math.floor(Math.random()*6);
          for(let i=0;i<b.dice;i++)sb+=1+Math.floor(Math.random()*6);
          if(sa>sb){b.dice=a.dice-1;b.arm=pn;}
          a.dice=1; battles++;
          game.set_area_tc(pn);game.set_area_tc(old);
          if(game.player[0].area_tc===0 && humanEliminatedAt===null)humanEliminatedAt=battles;
          if(living().length===1)break;
          if(guard===9999)throw new Error('Battle guard reached');
        }
        if(living().length===1)continue;
        const p=game.player[pn];
        p.stock=Math.min(64,p.stock+p.area_tc);
        while(p.stock>0) {
          const eligible=game.adat.map((a,id)=>({a,id})).filter(({a})=>a.size>0&&a.arm===pn&&a.dice<8);
          if(!eligible.length)break;
          eligible[Math.floor(Math.random()*eligible.length)].a.dice++;p.stock--;supplied++;
        }
        do {game.ban=(game.ban+1)%game.pmax;} while(game.player[game.get_pn()].area_tc===0);
        if(game.adat.some(a=>a.size>0&&(a.dice<1||a.dice>8)))throw new Error('Dice invariant failed');
        if(game.player.some(p=>p.stock<0||p.stock>64))throw new Error('Stock invariant failed');
        turns++;
      }
      throw new Error('Simulation turn bound exceeded');
    })()`, context, { timeout: 30000 });
    simulations.push({ playerCount: count, seed, ...result });
  }
}
const report = {
  schemaVersion: 1,
  evidenceKind: 'AS2 numeric-class translation with injected LCG; not a Flash Player recording',
  limitation: 'Simulation harness omits animation RNG calls and continues after human elimination to exercise completion. These are not original campaign traces.',
  sourceHashes,
  comparedEngineSha256: hash(engineSource),
  rng: { algorithm: 'LCG uint32', multiplier: 1664525, increment: 1013904223, divisor: 4294967296 },
  mapCases: cases.length, differences, cases, aiProbes, simulations,
};
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'oracle-report.json'), JSON.stringify(report, null, 2)+'\n');
await writeFile(path.join(outputDirectory, 'map-fixtures.json'), evidenceJson({ sourceHashes, fixtures, reroll })+'\n');
console.log(JSON.stringify({ mapCases: cases.length, differences, aiProbes: aiProbes.length, simulations: simulations.length, maxTurns: Math.max(...simulations.map(s=>s.turns)) }, null, 2));
