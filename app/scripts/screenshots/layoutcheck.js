// DOM layout checker, injected by shoot.mjs after a scene settles. Returns a JSON string:
//   { vw, vh, violations: [{ type, sev, desc, text, rect, other? }] }
// Types (sev "error" unless noted):
//   page-hscroll      the document scrolls sideways
//   scroll-hclip      a vertical scroller is narrower than its content (content cut off at the side)
//   beyond-viewport   an element's box extends past the left/right edge of the screen (not in a horizontal scroller / map)
//   offscreen         text or a control is partly/fully off the screen and cannot be scrolled to (not in a scroller)
//   text-clipped      text is cut by an ancestor with overflow:hidden (no ellipsis)
//   text-truncated    (warn) text ends in an ellipsis (numberOfLines) – fine when designed so, flagged when new
//   target-small      a pressable's touch area (incl. hitSlop) is under 44x44
//   overlap-text      two different pieces of text overlap
//   overlap-control   two controls overlap
//   overlap-control-text  a control sits over text that is not its own
(function () {
  const root = document.getElementById('root');
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = [];
  if (!root) return JSON.stringify({ vw, vh, violations: [{ type: 'no-root', sev: 'error', desc: 'no #root' }] });
  const frame = root.firstElementChild;
  const R = (r) => ({ x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
  const cs = (el) => getComputedStyle(el);
  const visible = (el) => { try { return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); } catch { return cs(el).display !== 'none'; } };
  const inMap = (el) => !!el.closest('[data-map]');
  const inSvg = (el) => !!el.closest('svg');
  const desc = (el) => {
    const id = el.getAttribute('data-testid'), al = el.getAttribute('aria-label'), role = el.getAttribute('role');
    let d = el.tagName.toLowerCase();
    if (role) d += `[${role}]`;
    if (id) d += `#${id}`;
    else if (al) d += `<${al.slice(0, 40)}>`;
    return d;
  };
  const ownText = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
  const textRect = (el) => {
    let u = null;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) { if (r.width < 0.5 || r.height < 0.5) continue; u = u ? { left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
    }
    if (!u) return null;
    // an element that clips itself (numberOfLines: ellipsis / line clamp) only shows what is inside its own box
    const st = cs(el), er = el.getBoundingClientRect();
    if (st.overflowX === 'hidden') { u.left = Math.max(u.left, er.left); u.right = Math.min(u.right, er.right); }
    if (st.overflowY === 'hidden') { u.top = Math.max(u.top, er.top); u.bottom = Math.min(u.bottom, er.bottom); }
    if (u.right - u.left < 0.5 || u.bottom - u.top < 0.5) return null;
    return { ...u, width: u.right - u.left, height: u.bottom - u.top };
  };
  // ancestors that really cut content (not the screen frame, not scrollers on their scroll axis)
  const clippers = (el) => {
    const res = [];
    for (let p = el.parentElement; p && p !== frame && p !== root; p = p.parentElement) {
      const s = cs(p);
      const cx = s.overflowX === 'hidden' || s.overflowX === 'clip', cy = s.overflowY === 'hidden' || s.overflowY === 'clip';
      if (cx || cy) res.push({ el: p, cx, cy, r: p.getBoundingClientRect() });
    }
    return res;
  };
  const inHScroller = (el) => { for (let p = el.parentElement; p && p !== root; p = p.parentElement) { const s = cs(p); if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const inVScroller = (el) => { for (let p = el.parentElement; p && p !== root; p = p.parentElement) { const s = cs(p); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true; } return false; };
  // nearest vertical scroller (the content of a ScrollView scrolls under chrome by design)
  const scrollerOf = (el) => { for (let p = el.parentElement; p && p !== root; p = p.parentElement) { const s = cs(p); if (s.overflowY === 'auto' || s.overflowY === 'scroll') return p; } return null; };
  // the part of `r` that is actually visible through every clipping ancestor (scrollers included); null if none
  const visRect = (el, r) => {
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = el.parentElement; p && p !== frame && p !== root; p = p.parentElement) {
      const s = cs(p);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (s.overflowX !== 'visible') { v.left = Math.max(v.left, pr.left); v.right = Math.min(v.right, pr.right); }
      if (s.overflowY !== 'visible') { v.top = Math.max(v.top, pr.top); v.bottom = Math.min(v.bottom, pr.bottom); }
    }
    return v.right - v.left > 0.5 && v.bottom - v.top > 0.5 ? v : null;
  };
  // an item hidden under a modal layer (a sheet, a scrim, an overlay) cannot collide with what is above it
  const vwArea = vw * vh;
  const layerOf = (e) => { let z = 0; for (let p = e; p && p !== root; p = p.parentElement) { const n = parseInt(cs(p).zIndex, 10); if (!isNaN(n) && n > z) z = n; } return z; };
  const covered = (el, v) => {
    if (!v) return false;
    const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];
    return pts.some(([fx, fy]) => {
      const hit = document.elementFromPoint(v.left + (v.right - v.left) * fx, v.top + (v.bottom - v.top) * fy);
      if (!hit || el.contains(hit) || hit.contains(el)) return false;
      // under a modal layer (sheet z-index 120): the hit element lives in a higher layer than this one
      if (layerOf(hit) >= 100 && layerOf(hit) > layerOf(el)) return true;
      const r = hit.getBoundingClientRect();
      return r.width * r.height > vwArea * 0.25;
    });
  };
  const push = (type, el, extra = {}) => out.push({ type, sev: extra.sev || 'error', desc: desc(el), text: (ownText(el) || el.getAttribute('aria-label') || '').slice(0, 60), rect: R(el.getBoundingClientRect()), ...extra });

  // (a) horizontal overflow
  if (document.documentElement.scrollWidth > vw + 1) out.push({ type: 'page-hscroll', sev: 'error', desc: 'html', text: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });
  const els = Array.from(root.querySelectorAll('*')).filter((el) => visible(el) && !inSvg(el) || el.tagName.toLowerCase() === 'svg' && visible(el));
  for (const el of els) {
    const s = cs(el);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && (s.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1 && !inMap(el)) {
      push('scroll-hclip', el, { text: `content ${el.scrollWidth} > ${el.clientWidth}` });
    }
  }
  // (b) boxes beyond the screen edge; offscreen text/controls
  const INTERACTIVE = '[tabindex="0"], button, a[href], input:not([type=hidden]), textarea, select, [role=button], [role=switch], [role=tab], [role=radio], [role=checkbox], [role=link]';
  const isInteractive = (el) => el.matches(INTERACTIVE) && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-hidden') !== 'true' && cs(el).pointerEvents !== 'none';
  const offending = new Set();
  for (const el of els) {
    if (el.tagName.toLowerCase() === 'svg' || inMap(el) || inHScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.left < -1 || r.right > vw + 1) {
      // an ancestor that clips this element hides the overflow: that is covered by text-clipped, not here
      const cl = clippers(el).find((c) => c.cx && (r.left < c.r.left - 1 || r.right > c.r.right + 1));
      if (!cl && !offending.has(el.parentElement)) { offending.add(el); push('beyond-viewport', el, { text: ownText(el).slice(0, 40) }); }
    }
  }
  // ---- gather text leaves and controls (re-run after scrolling for the end-state pass) ----
  // toasts are transient floating notices: they may sit over anything for a few seconds by design
  const inToast = (el) => !!el.closest('[data-testid="overlay-toast"], [data-testid="toast-container"]');
  const gatherTexts = () => {
    const list = [];
    for (const el of els) {
      if (el.tagName.toLowerCase() === 'svg' || inMap(el) || inToast(el)) continue;
      const t = ownText(el);
      if (!t) continue;
      const tr = textRect(el);
      if (!tr) continue;
      const vr = visRect(el, tr);
      list.push({ el, tr, t, vr: covered(el, vr) ? null : vr, sc: scrollerOf(el) });
    }
    return list;
  };
  const gatherControls = () => {
    const list = [];
    for (const el of els) {
      if (el.tagName.toLowerCase() === 'svg' || inMap(el) || inToast(el) || !isInteractive(el)) continue;
      if (Array.from(el.querySelectorAll(INTERACTIVE)).some((c) => isInteractive(c) && visible(c))) continue; // a container of controls
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const hs = (el.getAttribute('data-hitslop') || '').split(',').map(Number);
      const [ht, hr, hb, hl] = hs.length === 4 && hs.every((n) => !isNaN(n)) ? hs : [0, 0, 0, 0];
      const vr = visRect(el, r);
      list.push({ el, r, w: r.width + hl + hr, h: r.height + ht + hb, slop: hs.some((n) => n), vr: covered(el, vr) ? null : vr, sc: scrollerOf(el) });
    }
    return list;
  };
  const texts = gatherTexts();
  // number of distinct lines a text element's glyphs occupy
  const lineCount = (el) => {
    const tops = new Set();
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) tops.add(Math.round(r.top / Math.max(4, r.height * 0.5)));
    }
    return tops.size;
  };
  for (const { el, tr, t } of texts) {
    const fs = parseFloat(cs(el).fontSize) || 14;
    // text-clipped by container overflow
    const sc = scrollerOf(el);
    for (const c of clippers(el)) {
      // below the fold of a scroller is not clipped: ignore vertical cuts by containers that enclose the scroller
      const outer = sc && c.el !== sc && c.el.contains(sc);
      const dx = Math.max(c.r.left - tr.left, tr.right - c.r.right), dy = Math.max(c.r.top - tr.top, tr.bottom - c.r.bottom);
      if ((c.cx && dx > fs * 0.3 + 1) || (c.cy && !outer && dy > fs * 0.3 + 1)) {
        // ellipsis on the element itself is reported below as a truncation
        const s = cs(el);
        if (c.el === el && s.textOverflow === 'ellipsis') continue;
        push('text-clipped', el, { text: t.slice(0, 50), by: desc(c.el), over: Math.round(Math.max(dx, dy)) });
        break;
      }
    }
    // ellipsis / line-clamp truncation on the element itself
    const s = cs(el);
    if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 0.5) push('text-truncated', el, { sev: 'warn', text: t.slice(0, 50) });
    else if ((s.webkitLineClamp && s.webkitLineClamp !== 'none') && el.scrollHeight > el.clientHeight + 1) push('text-truncated', el, { sev: 'warn', text: t.slice(0, 50) });
    // a word broken in the middle: more lines than words ("Me / etu / p")
    else if (s.whiteSpace !== 'nowrap') {
      const words = t.split(/\s+/).filter(Boolean).length;
      const lines = lineCount(el);
      if (lines > words) push('text-word-broken', el, { text: t.slice(0, 50), lines, words });
    }
    // offscreen (cannot be scrolled to)
    if (!inVScroller(el) && !inHScroller(el)) {
      const off = tr.left < -1 || tr.right > vw + 1 || tr.top < -1 || tr.bottom > vh + 1;
      if (off) push('offscreen', el, { text: t.slice(0, 50) });
    }
  }
  // (d) touch targets
  const controls = gatherControls();
  for (const c of controls) {
    const { el, r, w, h, slop } = c;
    // dense letter keyboards (join code): 28 pt wide x 44 pt high minimum, announced by testID letter-key-*
    const dense = (el.getAttribute('data-testid') || '').startsWith('letter-key-');
    if (w < (dense ? 27.5 : 43.5) || h < 43.5) push('target-small', el, { text: `${Math.round(w)}x${Math.round(h)}${slop ? ' (with hitSlop)' : ''}` });
    if (!inVScroller(el) && !inHScroller(el) && (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1)) push('offscreen', el, { text: 'control' });
  }
  // (e) overlaps
  const big = (r) => r.width * r.height > vw * vh * 0.4;
  const inter = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
  const related = (a, b) => a.contains(b) || b.contains(a);
  const label = (x) => (ownText(x.el) || x.el.getAttribute('aria-label') || '').slice(0, 30);
  const overlaps = (texts, controls, comparable, phase) => {
    const seen = new Set();
    const tag = phase ? { phase } : {};
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (!comparable(a, b)) continue;
      const ar = { left: a.vr.left, right: a.vr.right, top: a.vr.top + a.tr.height * 0.2, bottom: a.vr.bottom - a.tr.height * 0.2 };
      const br = { left: b.vr.left, right: b.vr.right, top: b.vr.top + b.tr.height * 0.2, bottom: b.vr.bottom - b.tr.height * 0.2 };
      const o = inter(ar, br);
      if (o.w > 2 && o.h > 2) {
        const k = desc(a.el) + '|' + desc(b.el);
        if (seen.has(k)) continue; seen.add(k);
        out.push({ type: 'overlap-text', sev: 'error', desc: desc(a.el), text: a.t.slice(0, 30), other: `${desc(b.el)} "${b.t.slice(0, 30)}"`, rect: R(a.tr), ...tag });
      }
    }
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (!comparable(a, b) || big(a.r) || big(b.r)) continue;
      const o = inter(a.vr, b.vr);
      if (o.w > 2 && o.h > 2) out.push({ type: 'overlap-control', sev: 'error', desc: desc(a.el), text: label(a), other: `${desc(b.el)} "${label(b)}"`, rect: R(a.r), ...tag });
    }
    for (const c of controls) {
      if (big(c.r)) continue;
      for (const t of texts) {
        if (!comparable(c, t)) continue;
        const o = inter(c.vr, { left: t.vr.left, right: t.vr.right, top: t.vr.top + t.tr.height * 0.2, bottom: t.vr.bottom - t.tr.height * 0.2 });
        if (o.w > 2 && o.h > 2) out.push({ type: 'overlap-control-text', sev: 'error', desc: desc(c.el), text: label(c), other: `${desc(t.el)} "${t.t.slice(0, 30)}"`, rect: R(c.r), ...tag });
      }
    }
  };
  // two things overlap only if both are visible there and they live in the same scroller (or neither scrolls)
  overlaps(texts, controls, (a, b) => a.vr && b.vr && a.sc === b.sc && !related(a.el, b.el), '');
  // End-state pass: scroll every scroller to its end. Content that is *still* under pinned chrome (a CTA, a keypad, a dock)
  // can never be uncovered by scrolling, so a pinned block that is taller than its reserved space shows up here.
  const scrollers = els.filter((e) => { const st = cs(e); return (st.overflowY === 'auto' || st.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 1 && !inMap(e); });
  const saved = scrollers.map((e) => e.scrollTop);
  scrollers.forEach((e) => { e.scrollTop = e.scrollHeight; });
  const texts2 = gatherTexts(), controls2 = gatherControls();
  overlaps(texts2, controls2, (a, b) => a.vr && b.vr && a.sc !== b.sc && !related(a.el, b.el) && !(a.sc && b.sc), 'scrolled-to-end');
  scrollers.forEach((e, i) => { e.scrollTop = saved[i]; });
  return JSON.stringify({ vw, vh, violations: out });
})();
