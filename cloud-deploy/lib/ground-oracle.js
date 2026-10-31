// Build interrogation text from stored submissions, not model-attributed claims.
// The model selects the target and evidence; the server owns who said what.
export function groundOracle(output, players) {
  const target = players.find(p => p.id === output.interrogate);
  if (!target?.answer) throw Object.assign(new Error('Oracle target has no submitted statement'), { status: 502 });
  const suppliedQuote = typeof output.statementQuote === 'string' ? output.statementQuote.trim() : '';
  const statementQuote = suppliedQuote && target.answer.includes(suppliedQuote) ? suppliedQuote : target.answer;
  const evidenceQuote = typeof output.evidenceQuote === 'string' ? output.evidenceQuote.trim() : '';
  const evidenceOwner = players.find(p => p.id === output.evidencePlayerId && evidenceQuote && p.evidence?.text?.includes(evidenceQuote));
  return {
    suspect: output.suspect, interrogate: target.id, confidence: output.confidence,
    statementQuote,
    ...(evidenceOwner ? { evidenceQuote, evidencePlayerId: evidenceOwner.id } : {}),
    reason: evidenceOwner
      ? 'I am comparing your submitted statement with the cited evidence. This question is not proof of sabotage.'
      : 'I am asking you to explain your own submitted statement. This question is not proof of sabotage.',
    question: evidenceOwner
      ? `How does your statement fit with this evidence: “${evidenceQuote}”? Explain whether they agree or conflict.`
      : 'Which specific evidence supports your statement, and what would make you reconsider it?',
  };
}
