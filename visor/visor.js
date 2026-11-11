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
    + "if(!a)return;const h=a.getAttribute('href')||'';e.preventDefault();if(h.length>1&&h[0]==='#')location.hash=h.slice(1)},true)})();"
    + `(${enElDocumento})();`;
  // Also inside the document, before anything of it, written as a function and pasted in as text (it never runs in
  // this page):
  //   · what the student selects goes up to this page as plain text with its first and last boxes, so whoever holds
  //     the reader can put a «Preguntar» over it. Nothing while a mouse button is down; again on scroll. A
  //     «soltar-seleccion» from this page clears it.
  //   · the scrollbar takes the scheme of what the document paints: the style goes first and with no weight
  //     (:where), so a color-scheme of the document's own always wins over it.
  function enElDocumento() {
    const padre = window.parent;
    const marca = document.createElement('style');
    document.head.append(marca);
    const caja = (c) => [c.left, c.top, c.right, c.bottom];
    let hay = false;
    let apretado = false;
    let espera = 0;
    const decir = () => {
      const s = getSelection();
      let texto = '';
      let cajas = [];
      if (s && s.rangeCount && !s.isCollapsed) {
        const rs = [...s.getRangeAt(0).getClientRects()].filter((c) => c.width || c.height);
        texto = String(s).slice(0, 4000);
        if (texto.trim() && rs.length) cajas = [caja(rs[0]), caja(rs[rs.length - 1])];
        else texto = '';
      }
      if (!texto && !hay) return;
      hay = Boolean(texto);
      padre.postMessage({ tipo: 'visor-seleccion', texto, cajas }, '*');
    };
    const revisar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => { if (!apretado) decir(); }, 140);
    };
    const soltado = () => {
      if (!apretado) return;
      apretado = false;
      revisar();
    };
    document.addEventListener('selectionchange', revisar);
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      apretado = true;
      if (hay) {
        hay = false;
        padre.postMessage({ tipo: 'visor-seleccion', texto: '', cajas: [] }, '*');
      }
    }, true);
    addEventListener('pointerup', soltado, true);
    // A drag released outside the document: the next move here, with no button down, ends it.
    addEventListener('pointermove', (e) => { if (!e.buttons) soltado(); }, true);
    let cuadro = 0;
    addEventListener('scroll', () => {
      if (!hay || apretado || cuadro) return;
      cuadro = requestAnimationFrame(() => {
        cuadro = 0;
        if (!apretado) decir();
      });
    }, { capture: true, passive: true });
    addEventListener('message', (e) => {
      if (e.source === padre && e.data && e.data.tipo === 'soltar-seleccion') getSelection().removeAllRanges();
    });

    // The scheme by the luminance of the background the document paints (body, if not html); none when it paints none.
    const esquema = () => {
      const fondo = (el) => (el ? getComputedStyle(el).backgroundColor : '');
      const leer = (c) => {
        const n = /^rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\)$/.exec(c);
        if (!n || (n[4] !== undefined && parseFloat(n[4]) === 0)) return null;
        return (0.2126 * n[1] + 0.7152 * n[2] + 0.0722 * n[3]) / 255;
      };
      const luz = leer(fondo(document.body)) ?? leer(fondo(document.documentElement));
      const texto = luz === null ? '' : `:where(:root){color-scheme:${luz < 0.5 ? 'dark' : 'light'}}`;
      if (marca.textContent !== texto) marca.textContent = texto;
    };
    let tarde = 0;
    const cambio = () => {
      esquema();
      // Again once a fade between themes is over.
      clearTimeout(tarde);
      tarde = setTimeout(esquema, 600);
    };
    const mirar = new MutationObserver(cambio);
    const atar = () => {
      mirar.observe(document.documentElement, { attributes: true });
      if (document.body) mirar.observe(document.body, { attributes: true });
      cambio();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', atar);
    else atar();
    addEventListener('load', cambio);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', cambio);
  }
  const ENCABEZADO = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${REGLA}"><script>${PREPARAR}</script>`;

  const marco = document.getElementById('marco');
  if (!marco || window.parent === window) return;
  let mostrado = false;
  // Who handed the document: the only one told what is selected in it.
  let quien = null;
  // A box as it goes up: four finite numbers, or nothing.
  const caja = (c) => (Array.isArray(c) && c.length === 4 && c.every((n) => typeof n === 'number' && Number.isFinite(n)) ? c.slice() : null);
  window.addEventListener('message', (e) => {
    const d = e.data;
    // What is selected in the document, rebuilt from scratch: its scripts can send anything.
    if (e.source === marco.contentWindow && marco.contentWindow) {
      if (!quien || !d || d.tipo !== 'visor-seleccion') return;
      const cajas = Array.isArray(d.cajas) && d.cajas.length === 2 ? d.cajas.map(caja) : [];
      const texto = typeof d.texto === 'string' ? d.texto.slice(0, 4000) : '';
      const bien = texto && cajas.length === 2 && cajas.every(Boolean);
      window.parent.postMessage({ tipo: 'visor-seleccion', texto: bien ? texto : '', cajas: bien ? cajas : [] }, quien);
      return;
    }
    if (e.source !== window.parent || !PADRE.test(e.origin)) return;
    if (d && d.tipo === 'soltar-seleccion') {
      if (mostrado && marco.contentWindow) marco.contentWindow.postMessage({ tipo: 'soltar-seleccion' }, '*');
      return;
    }
    if (mostrado) return;
    if (!d || d.tipo !== 'resumen' || typeof d.html !== 'string' || d.html.length > TOPE) return;
    if (typeof d.titulo === 'string') marco.title = d.titulo.slice(0, 200);
    // One document per reader: a second message does not replace it.
    mostrado = true;
    quien = e.origin;
    marco.srcdoc = ENCABEZADO + d.html;
  });
  window.parent.postMessage({ tipo: 'visor-listo' }, '*');
})();
