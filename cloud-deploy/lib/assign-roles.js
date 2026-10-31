import { randomInt } from 'node:crypto';

// Draw the hidden allegiance independently of the shuffled evidence deck.
// Every card is legitimate and can belong to either a crewmate or Saboteur.
export function assignRoles(players, draw = randomInt) {
  const cards = [
    { role: 'security-officer', evidence: { kind: 'image', role: 'security-officer', imageUrl: '/evidence/pod-b.svg',
      text: 'Final security image recovered before the explosion: Pod B (Borealis) shows severe damage to its external power cables.\nPOD B → POWER MAY BE COMPROMISED.\nYou know nothing about its oxygen or navigation.' } },
    { role: 'life-support-engineer', evidence: { kind: 'text', role: 'life-support-engineer',
      text: "Yesterday's maintenance report: Pod C (Cygnus) FAILED its emergency oxygen test.\nPOD C → OXYGEN ✗\nPod C cannot safely evacuate the crew." } },
    { role: 'navigation-engineer', evidence: { kind: 'text', role: 'navigation-engineer',
      text: 'Navigation diagnostics: Pod A (Apollo) navigation OFFLINE. Pod D (Draco) navigation ONLINE.\nPOD A → NAVIGATION ✗\nYou do not know whether Pod D has oxygen and power.' } },
    { role: 'systems-engineer', evidence: { kind: 'text', role: 'systems-engineer',
      text: "Emergency power report: Pod D (Draco) power ONLINE. Pod D's emergency oxygen indicator is still transmitting normally.\nPOD D → POWER ✓\nPOD D → OXYGEN ✓" } },
  ];
  const saboteurIndex = draw(players.length);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  players.forEach((player, index) => {
    player.ready = false;
    player.role = index === saboteurIndex ? 'saboteur' : cards[index].role;
    player.evidence = cards[index].evidence;
  });
  return players[saboteurIndex].id;
}
