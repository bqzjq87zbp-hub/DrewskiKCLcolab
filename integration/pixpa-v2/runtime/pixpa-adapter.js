// Page-local integration. Keep the accepted camera/scroll engine unmodified.
import './main-v2.js';
const site='https://kiyonocreativelab.com';
const panel=document.getElementById('menu-panel');
for(const[label,path]of [['Return to main site','/'],['Plan Your Portrait','/inquiry-form']]){
  const link=document.createElement('a');
  link.href=site+path;link.target='_top';link.textContent=label;
  link.dataset.nativeDestination='true';panel.append(link);
}
// Preserve genuine anchor navigation and make the Inquiry escape leave the iframe.
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if(link&&new URL(link.href,location.href).origin===site)link.target='_top';
},true);
document.documentElement.dataset.pixpaPierAdapter='20260910-walk';
