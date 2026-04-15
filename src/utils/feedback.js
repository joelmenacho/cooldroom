export function okFeedback() {
  try { if (navigator.vibrate) navigator.vibrate(60); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.04;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 80);
  } catch {}
}
export function errorFeedback() {
  try { if (navigator.vibrate) navigator.vibrate([60, 60, 120]); } catch {}
}
