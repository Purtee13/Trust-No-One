import test from 'node:test';
import assert from 'node:assert/strict';
import { groundOracle } from './cloud-deploy/lib/ground-oracle.js';
const players = [
  { id: 'alex', answer: 'D is safe.', evidence: { text: 'Pod D has power.' } },
  { id: 'sam', answer: 'B looks safe.', evidence: { text: 'Pod B power cables damaged.' } },
];
test('a quote from the wrong player cannot be attributed to the selected target', () => {
  const result = groundOracle({ suspect: 'sam', interrogate: 'alex', confidence: 70,
    statementQuote: 'B looks safe.', reason: 'Alex defended B.', question: 'Why did you defend B?' }, players);
  assert.equal(result.interrogate, 'alex');
  assert.equal(result.statementQuote, 'D is safe.');
  assert.ok(!JSON.stringify(result).includes('Alex defended B'));
  assert.ok(!result.question.includes('defend B'));
});
test('valid quotes and evidence remain tied to their actual sources', () => {
  const result = groundOracle({ suspect: 'sam', interrogate: 'sam', confidence: 70,
    statementQuote: 'B looks safe.', evidencePlayerId: 'sam', evidenceQuote: 'power cables damaged' }, players);
  assert.equal(result.statementQuote, players[1].answer);
  assert.equal(result.evidencePlayerId, 'sam');
  assert.match(result.question, /power cables damaged/);
});
test('invented evidence and targets without submissions are rejected or omitted', () => {
  const result = groundOracle({ interrogate: 'alex', evidencePlayerId: 'alex', evidenceQuote: 'Oxygen exploded' }, players);
  assert.equal(result.evidenceQuote, undefined);
  assert.ok(!result.question.includes('Oxygen exploded'));
  assert.throws(() => groundOracle({ interrogate: 'absent' }, players), { status: 502 });
});
