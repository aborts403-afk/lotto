(() => {
  const KEY = 'my-tickets-v1';
  const ROUND = 1248;
  const sets = [
    [16, 18, 27, 36, 38, 42], // 1등
    [16, 18, 22, 27, 36, 38], // 2등 (5개 + 보너스 22)
    [3, 16, 18, 27, 36, 38],  // 3등
    [5, 16, 18, 27, 36, 44],  // 4등
    [1, 9, 16, 18, 27, 40],   // 5등
    [7, 16, 22, 30, 38, 45],  // 낙첨 (2개 + 보너스)
    [2, 11, 19, 27, 33, 41],  // 낙첨
    [4, 12, 23, 31, 39, 44],  // 낙첨
    [6, 13, 20, 29, 35, 43],  // 낙첨
    [8, 14, 21, 28, 34, 40],  // 낙첨
  ];
  const now = Date.now();
  const existing = JSON.parse(localStorage.getItem(KEY) || '[]');
  const seen = new Set(existing.map((t) => `${t.round}:${t.numbers.join(',')}`));
  const added = sets
    .filter((n) => !seen.has(`${ROUND}:${n.join(',')}`))
    .map((numbers, i) => ({
      id: `seed-${ROUND}-${i}-${now.toString(36)}`,
      round: ROUND,
      numbers,
      source: 'manual',
      createdAt: new Date(now - i).toISOString(),
    }));
  localStorage.setItem(KEY, JSON.stringify([...added, ...existing]));
  console.log(`${added.length}장 추가 (전체 ${added.length + existing.length}장). 새로고침하면 보여요.`);
})();
