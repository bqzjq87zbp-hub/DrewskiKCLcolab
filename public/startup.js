// Keep the static photograph and real image links usable if a module or data
// request fails. The 3D engine has its own bounded loading/recovery state.
const note = document.querySelector('#startup-note');
let failed = false;
function unavailable() {
  if (failed || !note?.isConnected) return;
  failed = true;
  const menu = document.querySelector('#menu');
  if (menu) menu.hidden = true;
  note.querySelector('span').textContent = 'The walk could not start. You can still view the photographs.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.onclick = () => location.reload();
  note.append(retry);
}
note?.querySelector('a').addEventListener('click', () => { note.hidden = true; });
const deadline = setTimeout(unavailable, 20000);
import('./main-v2.js').then(() => {
  clearTimeout(deadline);
  note?.remove();
}).catch(() => {
  clearTimeout(deadline);
  unavailable();
});
