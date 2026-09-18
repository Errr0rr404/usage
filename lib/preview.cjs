function previewState() {
  return {
    accounts: [
      { id: 'preview-grok', provider: 'grok', label: 'Personal', meta: {} },
      { id: 'preview-mini', provider: 'minimax', label: 'Studio', meta: { region: 'global', countsAre: 'remaining' } },
      { id: 'preview-codex', provider: 'codex', label: 'Work', meta: {} },
      { id: 'preview-codex-2', provider: 'codex', label: 'Side project', meta: {} },
      { id: 'preview-claude', provider: 'claude', label: 'Main', meta: {} },
    ],
    snapshots: {
      'preview-grok': {
        ok: true,
        plan: 'SuperGrok',
        identity: 'ada@x.ai',
        windows: [
          { key: 'credits', label: 'Week', usedPercent: 28, used: null, limit: null, unit: 'percent', resetsAt: '2026-09-25T16:00:00.000Z', resetsInMs: null },
        ],
      },
      'preview-mini': {
        ok: true,
        plan: 'Max',
        identity: null,
        windows: [
          { key: 'five_hour', label: '5 hours', usedPercent: 8, used: 120, limit: 1500, unit: 'count', resetsAt: '2026-09-19T02:00:00.000Z', resetsInMs: null },
          { key: 'week', label: 'Week', usedPercent: 28, used: 4200, limit: 15000, unit: 'count', resetsAt: '2026-09-25T00:00:00.000Z', resetsInMs: null },
        ],
      },
      'preview-codex': {
        ok: true,
        plan: 'Plus',
        identity: 'ada@example.com',
        windows: [
          { key: 'primary', label: '5 hours', usedPercent: 61, used: null, limit: null, unit: 'percent', resetsAt: '2026-09-19T01:30:00.000Z', resetsInMs: null },
          { key: 'secondary', label: 'Week', usedPercent: 18, used: null, limit: null, unit: 'percent', resetsAt: '2026-09-24T12:00:00.000Z', resetsInMs: null },
        ],
      },
      'preview-codex-2': {
        ok: false,
        error: 'That Codex login was rejected. Add it again with a fresh token.',
        windows: [],
      },
      'preview-claude': {
        ok: true,
        plan: 'Max',
        identity: 'ada@anthropic.com',
        windows: [
          { key: 'five_hour', label: '5 hours', usedPercent: 86, used: null, limit: null, unit: 'percent', resetsAt: '2026-09-19T03:40:00.000Z', resetsInMs: null },
          { key: 'seven_day', label: 'Week', usedPercent: 40, used: null, limit: null, unit: 'percent', resetsAt: '2026-09-24T03:00:00.000Z', resetsInMs: null },
          { key: 'extra', label: 'Extra', usedPercent: 84, used: 42, limit: 50, unit: 'dollars', resetsAt: null, resetsInMs: null },
        ],
      },
    },
  };
}

module.exports = { previewState };
