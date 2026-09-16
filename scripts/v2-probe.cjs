// Drives the v2 list with a synthetic mouse (and a synthetic finger) and
// prints the settled geometry of every row for a set of pointer positions,
// so the list's model can be checked with numbers rather than by feel.
//
//   npx vite build --outDir /tmp/lp && python3 -m http.server 4199 -d /tmp/lp &
//   NODE_PATH=/path/to/node_modules/with/playwright node scripts/v2-probe.cjs http://127.0.0.1:4199 [scenario] [viewportH]
//
// Scenarios: sweep, open, cross, openup, bottom, touch, or all (default).
// Playwright is not a dependency of this repo; point NODE_PATH at an
// install that has it (on oci-ubuntu, /home/ubuntu/node_modules). WebGL
// is disabled so the page runs its CSS fallback and the list is pure DOM;
// the dwell is switched live through the tuning console's storage slot.
// PROBE_CONSOLE=1 echoes the page's console.

const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:4199';
const scenario = process.argv[3] || 'all';
const VH = parseInt(process.argv[4] || '900', 10);
const SHORT = 0.3; // seconds, to open a row
const LONG = 30; // seconds, so nothing opens while we measure

async function main() {
  const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: VH } });
  await ctx.route('**/sw.js', (r) => r.abort());
  await ctx.addInitScript((dwell) => {
    localStorage.setItem('lp-list-2', `44,1.5,110,${dwell}`);
  }, LONG);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  if (process.env.PROBE_CONSOLE) page.on('console', (m) => console.log('  >', m.text()));
  await page.goto(base + '/?era=v2');
  await page.waitForSelector('.v2-row');
  await page.waitForTimeout(300);

  const setDwell = (s) =>
    page.evaluate((s) => {
      localStorage.setItem('lp-list-2', `44,1.5,110,${s}`);
      window.dispatchEvent(new Event('lp:tune'));
    }, s);

  const snap = () =>
    page.evaluate(() => {
      const list = document.querySelector('.v2-list');
      const m = new DOMMatrixReadOnly(getComputedStyle(list).transform);
      const wrap = document.querySelector('.v2-wrap').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.v2-row')].map((el) => {
        const r = el.getBoundingClientRect();
        const head = el.querySelector('.v2-head');
        const hm = new DOMMatrixReadOnly(getComputedStyle(head).transform);
        const card = { height: [...el.querySelectorAll('.v2-line')].reduce((a, l) => a + l.getBoundingClientRect().height, 0) };
        return {
          name: el.querySelector('.v2-label').textContent,
          top: r.top,
          h: r.height,
          card: card.height,
          scale: hm.a,
          opacity: parseFloat(getComputedStyle(head).opacity),
          open: el.hasAttribute('data-expanded'),
          hot: !!el.querySelector('.v2-ring'),
        };
      });
      return { shift: m.f, wrapTop: wrap.top, wrapH: wrap.height, rows };
    });

  const same = (a, b) =>
    Math.abs(a.shift - b.shift) < 0.05 &&
    a.rows.every((r, i) => Math.abs(r.h - b.rows[i].h) < 0.05 && Math.abs(r.top - b.rows[i].top) < 0.05);
  const settle = async (max = 4000) => {
    let prev = await snap();
    const t0 = Date.now();
    while (Date.now() - t0 < max) {
      await page.waitForTimeout(60);
      const cur = await snap();
      if (same(prev, cur)) return cur;
      prev = cur;
    }
    console.log('  (did not settle in', max, 'ms)');
    return prev;
  };
  const underRow = (s, y) => s.rows.find((r) => y >= r.top && y < r.top + r.h);
  const fmt = (n, d = 1) => n.toFixed(d).padStart(6);
  const line = (s, y) => {
    const u = underRow(s, y);
    const o = s.rows.find((r) => r.open);
    const hs = s.rows.map((r) => (r.open ? '[' : '') + r.h.toFixed(0) + (r.open ? ']' : '')).join(' ');
    const uu = u ? `${u.name}@${u.top.toFixed(0)}` : '-';
    const oo = o ? `open=${o.name} ${o.top.toFixed(0)}..${(o.top + o.h).toFixed(0)}` : 'open=none';
    return `y=${String(y).padStart(4)} under=${uu.padEnd(14)} shift=${fmt(s.shift)} | ${hs} | ${oo}`;
  };
  // after one move, sample the row under the (now still) pointer for a while
  const trace = async (y, ms = 700) => {
    const t0 = Date.now();
    const seen = [];
    while (Date.now() - t0 < ms) {
      const s = await snap();
      const u = underRow(s, y);
      seen.push(`${((Date.now() - t0) / 1000).toFixed(2)}s ${u ? u.name + '@' + u.top.toFixed(0) : '-'} sh=${s.shift.toFixed(0)}`);
      await page.waitForTimeout(40);
    }
    console.log('  trace: ' + seen.join(' | '));
  };
  const X = 1280 / 2 - 100; // over the icons/labels

  const rest = await settle();
  console.log(`viewport ${VH}; wrap top=${rest.wrapTop.toFixed(1)} h=${rest.wrapH.toFixed(1)}; rows at rest:`);
  console.log('  ' + rest.rows.map((r) => `${r.name}@${r.top.toFixed(0)}`).join(' '));
  const rowTop = (name) => rest.rows.find((r) => r.name === name).top;
  const size = rest.rows[0].h;

  const park = async () => {
    await page.mouse.move(X, 2);
    await settle();
    await page.waitForTimeout(150);
  };
  const openOn = async (name) => {
    await park();
    const y0 = rowTop(name) + size / 2;
    await page.mouse.move(X, y0);
    await page.waitForTimeout(100);
    await setDwell(SHORT);
    await page.waitForTimeout(SHORT * 1000 + 300);
    await setDwell(LONG);
    const s = await settle();
    console.log('after dwell: ' + line(s, y0));
    return { s, y0 };
  };

  if (scenario === 'all' || scenario === 'sweep') {
    console.log('\n== sweep: pointer descends the resting list, nothing opens ==');
    for (let y = rest.rows[0].top - 20; y < rest.rows.at(-1).top + size + 20; y += 22) {
      await page.mouse.move(X, y);
      console.log(line(await settle(), y));
    }
  }

  if (scenario === 'all' || scenario === 'open') {
    console.log('\n== open: photopeace opens; walk down its head, its card, and into the rows below ==');
    const { s, y0 } = await openOn('photopeace');
    console.log('  scales: ' + s.rows.map((r) => r.name + ':' + r.scale.toFixed(2)).join(' '));
    const open = s.rows.find((r) => r.open);
    const end = open.top + open.h + 2 * size + 20;
    for (let y = y0 + 10; y < end; y += 10) {
      await page.mouse.move(X, y);
      const before = underRow(await snap(), y);
      const st = await settle();
      const after = underRow(st, y);
      let note = '';
      if (before && after && (before.name !== after.name || Math.abs(before.top - after.top) > 1))
        note = `  <-- moved under pointer: ${before.name}@${before.top.toFixed(0)} -> ${after.name}@${after.top.toFixed(0)}`;
      console.log(line(st, y) + note);
    }
  }

  if (scenario === 'all' || scenario === 'cross') {
    console.log('\n== cross: photopeace open, then one step from its card into the next row; watch the transient ==');
    const { s } = await openOn('photopeace');
    const open = s.rows.find((r) => r.open);
    const yCard = open.top + open.h - 8;
    await page.mouse.move(X, yCard);
    console.log(line(await settle(), yCard));
    const yNext = open.top + open.h + 8;
    await page.mouse.move(X, yNext);
    await trace(yNext);
    console.log(line(await settle(), yNext));
  }

  if (scenario === 'all' || scenario === 'openup') {
    console.log('\n== openup: photopeace opens; walk up into the rows above ==');
    const { y0 } = await openOn('photopeace');
    for (let y = y0 - 10; y > y0 - 3 * size; y -= 10) {
      await page.mouse.move(X, y);
      console.log(line(await settle(), y));
    }
  }

  if (scenario === 'all' || scenario === 'bottom') {
    console.log('\n== bottom: artmu (second to last) opens; its card must fit the viewport ==');
    const { s, y0 } = await openOn('artmu');
    const o = s.rows.find((r) => r.open);
    console.log(`  open=${o?.name} top=${o?.top.toFixed(1)} bottom=${(o.top + o.h).toFixed(1)} viewport=${VH}`);
    for (let y = y0 + 10; y < VH; y += 10) {
      await page.mouse.move(X, y);
      const before = underRow(await snap(), y);
      const st = await settle();
      const after = underRow(st, y);
      let note = '';
      if (before && after && (before.name !== after.name || Math.abs(before.top - after.top) > 1))
        note = `  <-- moved under pointer: ${before.name}@${before.top.toFixed(0)} -> ${after.name}@${after.top.toFixed(0)}`;
      console.log(line(st, y) + note);
    }
  }

  if (scenario === 'all' || scenario === 'touch') {
    console.log('\n== touch: finger holds artmu open, lifts, then lands on the row below the card ==');
    const touchAt = (type, y) =>
      page.evaluate(
        ([type, x, y]) => {
          const el = document.elementFromPoint(x, y) || document.body;
          el.dispatchEvent(
            new PointerEvent(type, {
              pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y,
              bubbles: true, cancelable: true, composed: true,
            }),
          );
        },
        [type, X, y],
      );
    await park();
    const y0 = rowTop('artmu') + size / 2;
    await setDwell(SHORT);
    await touchAt('pointerdown', y0);
    await page.waitForTimeout(SHORT * 1000 + 300);
    await setDwell(LONG);
    let s = await settle();
    console.log('held:   ' + line(s, y0));
    await touchAt('pointerup', y0);
    s = await settle();
    console.log('lifted: ' + line(s, y0));
    const o = s.rows.find((r) => r.open);
    console.log(`  card stays open=${!!o}; bottom=${o ? (o.top + o.h).toFixed(0) : '-'} viewport=${VH}`);
    const y1 = o.top + o.h + size / 2;
    await touchAt('pointerdown', y1);
    await trace(y1);
    s = await settle();
    console.log('down on next: ' + line(s, y1));
    await touchAt('pointerup', y1);
    s = await settle();
    console.log('lifted: ' + line(s, y1));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
