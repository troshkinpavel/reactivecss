for (const k of document.querySelectorAll('.k')) {
  let x = 0, y = 0, sx = 0, sy = 0, ox = 0, oy = 0, id = null;
  k.addEventListener('pointerdown', (e) => { id = e.pointerId; sx = e.clientX; sy = e.clientY; ox = x; oy = y; k.setPointerCapture(id); });
  k.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; x = ox + e.clientX - sx; y = oy + e.clientY - sy; k.style.translate = `${x}px ${y}px`; });
  k.addEventListener('pointerup', () => { id = null; });
  k.addEventListener('pointercancel', () => { id = null; });
}
