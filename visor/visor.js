// Reader of the summary bank of lutastudios.com for an HTML whose scripts the moderator turned on. It lives in this
// other address so that nothing it runs shares a place with the site. The page of the bank puts it in a frame with
// sandbox and hands it the HTML; this puts that HTML in a frame of its own, also with sandbox. Only a page of the site,
// of Super CVG (which opens the bank's summaries in full screen) or one on the computer itself, for the tests, as the
// parent of this frame, can hand it something to show.
(() => {
  'use strict';
  const PADRE = /^(https:\/\/(supercvg\.)?lutastudios\.com|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;
  const TOPE = 6 * 1024 * 1024;
  // The same rule as this page, written again inside the document. Then, before anything of the document runs:
  //   · memory that lasts while it is open, because the frame has no origin and the browser gives it no storage;
  //   · links within the page work: this document takes the address of this page as its base, so «#tema» would
  //     point here and leave it. A link to another page goes nowhere, instead of leaving an error in the frame.
  const REGLA = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; "
    + "media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'";
  const PREPARAR = '(()=>{const nueva=()=>{const m=new Map();return{get length(){return m.size},key:(i)=>[...m.keys()][i]??null,'
    + 'getItem:(k)=>(m.has(String(k))?m.get(String(k)):null),setItem:(k,v)=>{m.set(String(k),String(v))},'
    + 'removeItem:(k)=>{m.delete(String(k))},clear:()=>{m.clear()}}};'
    + "for(const n of['localStorage','sessionStorage']){let hay=false;try{hay=typeof window[n].length==='number'}catch{}"
    + 'if(!hay){try{Object.defineProperty(window,n,{value:nueva(),configurable:true})}catch{}}}'
    + "document.addEventListener('click',(e)=>{const a=e.target instanceof Element?e.target.closest('a[href],area[href]'):null;"
    + "if(!a)return;const h=a.getAttribute('href')||'';e.preventDefault();if(h.length>1&&h[0]==='#')location.hash=h.slice(1)},true)})();";
  const ENCABEZADO = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${REGLA}"><script>${PREPARAR}</script>`;

  const marco = document.getElementById('marco');
  if (!marco || window.parent === window) return;
  let mostrado = false;
  window.addEventListener('message', (e) => {
    if (mostrado || e.source !== window.parent || !PADRE.test(e.origin)) return;
    const d = e.data;
    if (!d || d.tipo !== 'resumen' || typeof d.html !== 'string' || d.html.length > TOPE) return;
    if (typeof d.titulo === 'string') marco.title = d.titulo.slice(0, 200);
    // One document per reader: a second message does not replace it.
    mostrado = true;
    marco.srcdoc = ENCABEZADO + d.html;
  });
  window.parent.postMessage({ tipo: 'visor-listo' }, '*');
})();
