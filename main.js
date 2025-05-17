const field = document.getElementById('field');

// 仮の選手データ
const players = [
  { number: 1, x: 100, y: 120 },
  { number: 2, x: 200, y: 120 },
  { number: 3, x: 300, y: 120 },
  { number: 4, x: 400, y: 120 },
  { number: 5, x: 500, y: 120 },
];

players.forEach(player => {
  const el = document.createElement('div');
  el.className = 'player';
  el.style.left = `${player.x}px`;
  el.style.top = `${player.y}px`;
  el.textContent = player.number;
  field.appendChild(el);
});
