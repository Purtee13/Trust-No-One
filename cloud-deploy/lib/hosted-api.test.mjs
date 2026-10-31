import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { gameFetch } from './hosted-api.js';
test('persistent hosted room privacy and full game', async () => {
 const sqlite = new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../drizzle/0000_special_killer_shrike.sql', import.meta.url),'utf8'));
 const DB = { prepare(sql) { let args=[]; return { bind(...v){args=v;return this;}, async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};} };} };
 async function call(path,body,token,status=200){
  const res=await gameFetch(new Request('https://game.test'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB});
  const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;
 }
 const host=await call('/api/rooms',{name:'Host'},null,201), root=`/api/rooms/${host.room.code}`, players=[host];
 for(const name of ['A','B','C'])players.push(await call(root+'/join',{name},null,201));
 await call(root+'/join',{name:'Fifth'},null,409);
 const control=(action,body={},status=200)=>call(root+'/'+action,body,host.hostToken,status);
 await control('start');
 const views=await Promise.all(players.map(p=>call(root,undefined,p.playerToken)));
 assert.equal(views.filter(v=>v.me.role==='saboteur').length,1);
 for(const v of views)assert.equal(v.players.some(p=>'role' in p||'token' in p),false);
 await control('advance');
 for(const p of players)await call(root+'/answer',{answer:'D has all systems online.'},p.playerToken);
 await control('generate-oracle',{},503);
 await control('oracle',{suspect:players[1].playerId,interrogate:host.playerId,confidence:60,reason:'Evidence.',question:'Why D?'});
 await control('shadow',{advice:'Question the report.'});
 await control('advance');
 await call(root+'/response',{response:'All three systems work.'},host.playerToken);
 await control('advance');
 for(const p of players)await call(root+'/vote',{pod:'D',suspect:players[1].playerId},p.playerToken);
 await control('oracle-vote',{suspect:players[1].playerId,reason:'Evidence.'});
 await control('advance');
 assert.equal((await call(root,undefined,host.playerToken)).result.survived,true);
 sqlite.close();
});
