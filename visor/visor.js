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

    // Where the pointer is, for whoever holds the reader, and where the others' land here. A place is said as Super CVG
    // says it (src/lib/enVivo/resumenMesa.js, `puntoEn` and `lugarDe`): by the content, never by the screen. The path of
    // child elements from the root to the one under the pointer and where in its box (0 to 1); over text, also which
    // text node of it and which letter, so it lands on the same word however the lines wrap in each window.
    //   · out: `visor-puntero` with the place (at most every 80 ms and the last one always, again on scroll), or null
    //     when the pointer leaves or a `soltar-puntero` says it left;
    //   · in: `ubicar-punteros` with [{ id, punto }]; it answers `visor-ubicados` with [{ id, x, y } | { id, fuera }] in
    //     this window, and again on its own scroll and resize. It draws nothing.
    const MAX_RUTA = 40;
    const CERCA = 24;
    const redondo = (n) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
    const rutaDe = (raiz, el) => {
      const ruta = [];
      let n = el;
      for (; n && n !== raiz; n = n.parentElement) {
        if (!n.parentElement) return null;
        ruta.push(Array.prototype.indexOf.call(n.parentElement.children, n));
      }
      return n === raiz ? ruta.reverse() : null;
    };
    const elementoDe = (raiz, ruta) => {
      let n = raiz;
      for (const i of ruta) {
        n = n.children[i];
        if (!n) return null;
      }
      return n;
    };
    const cajaDeLetra = (texto, letra) => {
      if (!texto || texto.nodeType !== 3 || letra > texto.length || !texto.length) return null;
      const rango = document.createRange();
      const desde = letra < texto.length ? letra : letra - 1;
      rango.setStart(texto, desde);
      rango.setEnd(texto, desde + 1);
      const c = rango.getClientRects()[0] || rango.getBoundingClientRect();
      if (!c || (!c.width && !c.height)) return null;
      return letra < texto.length ? c : { left: c.right, right: c.right, top: c.top, bottom: c.bottom, width: 0, height: c.height };
    };
    const letraEn = (x, y) => {
      const p = document.caretPositionFromPoint ? document.caretPositionFromPoint(x, y) : null;
      if (p) return { nodo: p.offsetNode, letra: p.offset };
      const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
      return r ? { nodo: r.startContainer, letra: r.startOffset } : null;
    };
    const puntoEn = (x, y) => {
      const raiz = document.documentElement;
      const objetivo = document.elementFromPoint(x, y);
      let el = objetivo && objetivo.nodeType === 3 ? objetivo.parentElement : objetivo;
      let ruta = el ? rutaDe(raiz, el) : null;
      if (!ruta) return null;
      const hondo = ruta.length > MAX_RUTA;
      if (hondo) {
        ruta = ruta.slice(0, MAX_RUTA);
        el = elementoDe(raiz, ruta);
      }
      const caja = el.getBoundingClientRect();
      const p = { r: ruta, x: caja.width ? redondo((x - caja.left) / caja.width) : 0, y: caja.height ? redondo((y - caja.top) / caja.height) : 0 };
      const letra = letraEn(x, y);
      const t = letra && letra.nodo;
      if (!hondo && t && t.nodeType === 3 && t.parentElement === el && Number.isInteger(letra.letra) && letra.letra >= 0 && letra.letra <= 1e6) {
        const c = cajaDeLetra(t, letra.letra);
        if (c && Math.abs(c.top + c.height / 2 - y) <= Math.max(c.height, 8) && x >= c.left - CERCA && x <= c.right + CERCA) {
          p.n = Array.prototype.indexOf.call(el.childNodes, t);
          p.o = letra.letra;
        }
      }
      return p;
    };
    const lugarDe = (p) => {
      const el = elementoDe(document.documentElement, p.r);
      if (!el) return null;
      if (p.n !== undefined) {
        const c = cajaDeLetra(el.childNodes[p.n], p.o);
        if (c) return { x: c.left, y: c.top + c.height / 2 };
      }
      const caja = el.getBoundingClientRect();
      if (!caja.width && !caja.height) return null;
      return { x: caja.left + p.x * caja.width, y: caja.top + p.y * caja.height };
    };

    let donde = null;
    let ultima = 0;
    let tardePuntero = 0;
    const marcar = () => {
      clearTimeout(tardePuntero);
      tardePuntero = 0;
      ultima = performance.now();
      if (!donde) return;
      let punto = null;
      try {
        punto = puntoEn(donde.x, donde.y);
      } catch {
        punto = null;
      }
      padre.postMessage({ tipo: 'visor-puntero', punto }, '*');
    };
    const pronto = () => {
      const falta = 80 - (performance.now() - ultima);
      if (falta <= 0) marcar();
      else if (!tardePuntero) tardePuntero = setTimeout(marcar, falta);
    };
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      donde = { x: e.clientX, y: e.clientY };
      pronto();
    }, { capture: true, passive: true });
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      donde = { x: e.clientX, y: e.clientY };
      marcar();
    }, { capture: true, passive: true });
    const fuera = () => {
      donde = null;
      clearTimeout(tardePuntero);
      tardePuntero = 0;
      padre.postMessage({ tipo: 'visor-puntero', punto: null }, '*');
    };
    // Out of the document: an out with nowhere else in it to go.
    document.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'touch' && !e.relatedTarget && donde) fuera();
    }, true);
    // The browser does not always tell a frame of another origin that the pointer left it: whoever holds the reader
    // hears the pointer on its own page and says so (`soltar-puntero`). The null that answers goes after anything said
    // before, so nothing from here is still on its way after it.
    addEventListener('message', (e) => {
      if (e.source === padre && e.data && e.data.tipo === 'soltar-puntero') fuera();
    });

    let lista = [];
    let cuadroOtros = 0;
    const ubicar = () => {
      cuadroOtros = 0;
      const ancho = innerWidth;
      const alto = innerHeight;
      padre.postMessage({ tipo: 'visor-ubicados', lista: lista.map(({ id, punto }) => {
        let l = null;
        try {
          l = lugarDe(punto);
        } catch {
          l = null;
        }
        return l && l.x >= 0 && l.y >= 0 && l.x <= ancho && l.y <= alto ? { id, x: l.x, y: l.y } : { id, fuera: true };
      }) }, '*');
    };
    const reubicar = () => {
      if (lista.length && !cuadroOtros) cuadroOtros = requestAnimationFrame(ubicar);
    };
    addEventListener('message', (e) => {
      if (e.source !== padre || !e.data || e.data.tipo !== 'ubicar-punteros' || !Array.isArray(e.data.lista)) return;
      lista = e.data.lista;
      cancelAnimationFrame(cuadroOtros);
      ubicar();
    });
    // Scrolling under a still pointer moves it over other content; the others' move with what they point at.
    addEventListener('scroll', () => {
      if (donde) pronto();
      reubicar();
    }, { capture: true, passive: true });
    addEventListener('resize', reubicar);
    // What the document's own scripts open or close moves the rest.
    new ResizeObserver(reubicar).observe(document.documentElement);

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
  // A place in the summary as Super CVG says it (src/lib/enVivo/resumenMesa.js `leerPunto`), rebuilt from scratch: a
  // path of at most 40 child positions, where in that box (0 to 1) and, maybe, a text node and a letter. Else nothing.
  const MAX_RUTA = 40;
  const MAX_HIJO = 100000;
  const MAX_LETRA = 1000000;
  // How many others at once, and the highest number one of them can go by.
  const MAX_LISTA = 50;
  const MAX_ID = 999;
  const LEJOS = 1e6;
  const indice = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  const fraccion = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  const coordenada = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= LEJOS;
  const punto = (p) => {
    if (!p || typeof p !== 'object' || !Array.isArray(p.r) || p.r.length > MAX_RUTA || !p.r.every((i) => indice(i, MAX_HIJO))) return null;
    if (!fraccion(p.x) || !fraccion(p.y)) return null;
    const bien = { r: p.r.slice(), x: p.x, y: p.y };
    if (indice(p.n, MAX_HIJO) && indice(p.o, MAX_LETRA)) {
      bien.n = p.n;
      bien.o = p.o;
    }
    return bien;
  };
  // Where each of the others lands in the document's window, or that it doesn't: entries that don't read are left out.
  const ubicado = (u) => {
    if (!u || typeof u !== 'object' || !indice(u.id, MAX_ID)) return null;
    if (u.fuera === true) return { id: u.id, fuera: true };
    return coordenada(u.x) && coordenada(u.y) ? { id: u.id, x: u.x, y: u.y } : null;
  };
  const aPedir = (u) => {
    if (!u || typeof u !== 'object' || !indice(u.id, MAX_ID)) return null;
    const p = punto(u.punto);
    return p ? { id: u.id, punto: p } : null;
  };
  const lista = (l, cada) => (Array.isArray(l) && l.length <= MAX_LISTA ? l.map(cada).filter(Boolean) : null);
  window.addEventListener('message', (e) => {
    const d = e.data;
    // From the document, rebuilt from scratch: its scripts can send anything. Only to who handed it.
    if (e.source === marco.contentWindow && marco.contentWindow) {
      if (!quien || !d) return;
      if (d.tipo === 'visor-seleccion') {
        const cajas = Array.isArray(d.cajas) && d.cajas.length === 2 ? d.cajas.map(caja) : [];
        const texto = typeof d.texto === 'string' ? d.texto.slice(0, 4000) : '';
        const bien = texto && cajas.length === 2 && cajas.every(Boolean);
        window.parent.postMessage({ tipo: 'visor-seleccion', texto: bien ? texto : '', cajas: bien ? cajas : [] }, quien);
      } else if (d.tipo === 'visor-puntero') {
        window.parent.postMessage({ tipo: 'visor-puntero', punto: punto(d.punto) }, quien);
      } else if (d.tipo === 'visor-ubicados') {
        const ubicados = lista(d.lista, ubicado);
        if (ubicados) window.parent.postMessage({ tipo: 'visor-ubicados', lista: ubicados }, quien);
      }
      return;
    }
    if (e.source !== window.parent || !PADRE.test(e.origin)) return;
    if (d && d.tipo === 'soltar-seleccion') {
      if (mostrado && marco.contentWindow) marco.contentWindow.postMessage({ tipo: 'soltar-seleccion' }, '*');
      return;
    }
    if (d && d.tipo === 'soltar-puntero') {
      if (e.origin === quien && marco.contentWindow) marco.contentWindow.postMessage({ tipo: 'soltar-puntero' }, '*');
      return;
    }
    // Where the others point, to place in the document: only from who handed it.
    if (d && d.tipo === 'ubicar-punteros') {
      const pedidos = e.origin === quien && marco.contentWindow ? lista(d.lista, aPedir) : null;
      if (pedidos) marco.contentWindow.postMessage({ tipo: 'ubicar-punteros', lista: pedidos }, '*');
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
