import { randomInt } from 'node:crypto';

// Draw the hidden allegiance independently of the shuffled evidence deck.
// Every card is legitimate and can belong to either a crewmate or Saboteur.
export function assignRoles(players, draw = randomInt) {
  const cards = [
    { role: 'security-officer', evidence: { kind: 'image', text: 'Security camera shows hull damage around Pod B.', imageUrl: '/evidence/pod-b.svg' } },
    { role: 'maintenance-engineer', evidence: { kind: 'text', text: 'Maintenance logs: Pod C failed its oxygen-system test.' } },
    { role: 'systems-engineer', evidence: { kind: 'text', text: 'Pod D system report: power ONLINE, oxygen ONLINE, navigation ONLINE.' } },
    { role: 'navigation-officer', evidence: { kind: 'text', text: 'Navigation report: Pod A guidance computer is OFFLINE.' } },
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
