import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRoles as localDeal } from './lib/assign-roles.js';
import { assignRoles as hostedDeal } from './cloud-deploy/lib/assign-roles.js';

for (const [name, deal] of [['local', localDeal], ['hosted', hostedDeal]]) {
  test(`${name}: every evidence assignment is possible with each Saboteur position`, () => {
    const assignments = new Map();
    const saboteurCards = new Set();
    for (let saboteur = 0; saboteur < 4; saboteur++) {
      for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 2; c++) {
        const draws = [saboteur, a, b, c];
        const players = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, ready: true }));
        const saboteurId = deal(players, bound => {
          const value = draws.shift(); assert.ok(value >= 0 && value < bound); return value;
        });
        assert.equal(saboteurId, `p${saboteur}`);
        assert.equal(players.filter(p => p.role === 'saboteur').length, 1);
        assert.ok(players.every(p => p.ready === false));
        const cards = players.map(p => p.evidence.text);
        assert.equal(new Set(cards).size, 4);
        assert.equal(players.filter(p => p.evidence.kind === 'image').length, 1);
        assert.ok(cards.every(text => !/outdated|secret|saboteur/i.test(text)));
        const layout = JSON.stringify(cards);
        if (!assignments.has(layout)) assignments.set(layout, new Set());
        assignments.get(layout).add(saboteurId);
        saboteurCards.add(players[saboteur].evidence.text);
      }
    }
    assert.equal(assignments.size, 24);
    assert.ok([...assignments.values()].every(ids => ids.size === 4));
    assert.equal(saboteurCards.size, 4);
  });
}
