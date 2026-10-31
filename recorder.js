// ===== 演示录制 / 回放（只在网址带 ?record 或 ?replay= 时启用，平时完全不出现）=====
// ?record                    录制模式：右下角出现录制面板，记录点击、输入、传图，可标记亮点并导出 JSON
// ?replay=/demo/xxx.json     回放模式：给 Sli.dev 用，接收 postMessage {type:'demo-goto', step} 跳到第几个亮点
(function () {
  const qs = new URLSearchParams(location.search);
  const MODE = qs.has('record') ? 'record' : qs.get('replay') ? 'replay' : '';
  if (!MODE) return;

  const REC_KEY = 'demo-recording';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 元素定位：最近的 id 祖先 + nth-child 路径 + 文字兜底 ----------
  function selOf(el) {
    const parts = [];
    let n = el;
    while (n && n !== document.body && n.nodeType === 1) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      const p = n.parentElement;
      if (!p) break;
      parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${[...p.children].indexOf(n) + 1})`);
      n = p;
    }
    return parts.join('>');
  }
  const textOf = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  function find(ev) {
    let el = null;
    try { el = document.querySelector(ev.sel); } catch (e) {}
    if (el && (!ev.text || textOf(el) === ev.text)) return el;
    if (ev.text) {
      const cands = [...document.querySelectorAll(ev.tag || '*')].filter((x) => textOf(x) === ev.text && x.offsetParent !== null);
      if (cands.length) return cands[cands.length - 1];
    }
    return el;
  }
  const ACTION = 'button, a, .chip, [onclick], [data-go], input, textarea, select, label, .clause-opt';

  // =====================================================================
  //  录制模式
  // =====================================================================
  if (MODE === 'record') {
    let rec = JSON.parse(localStorage.getItem(REC_KEY) || 'null');
    const persist = () => { localStorage.setItem(REC_KEY, JSON.stringify(rec)); paint(); };
    const push = (ev) => {
      if (!rec) return;
      ev.t = Date.now() - rec.startedAt;
      const last = rec.events[rec.events.length - 1];
      if (ev.type === 'input' && last && last.type === 'input' && last.sel === ev.sel) rec.events[rec.events.length - 1] = ev;
      else rec.events.push(ev);
      persist();
    };
    const inPanel = (el) => el.closest && el.closest('#rec-panel');

    document.addEventListener('click', (e) => {
      if (!rec || inPanel(e.target)) return;
      if (e.target.id === 'modal') return push({ type: 'click', sel: '#modal', text: '', tag: 'div' });
      const el = e.target.closest(ACTION);
      if (!el || el.matches('input[type=file]') || el.closest('.upl-btn')) return;
      if (el.matches('input[type=text], input:not([type]), textarea, input[type=datetime-local], input[type=date], select')) return; // 输入框只记内容
      push({ type: 'click', sel: selOf(el), text: textOf(el), tag: el.tagName.toLowerCase() });
    }, true);

    document.addEventListener('input', (e) => {
      if (!rec || inPanel(e.target)) return;
      const el = e.target;
      if (!el.matches('input, textarea') || el.type === 'file') return;
      push({ type: 'input', sel: selOf(el), tag: el.tagName.toLowerCase(), value: el.value });
    }, true);

    document.addEventListener('change', (e) => {
      if (!rec || inPanel(e.target)) return;
      const el = e.target;
      if (el.matches('select')) push({ type: 'select', sel: selOf(el), tag: 'select', value: el.value });
      else if (el.matches('input[type=datetime-local], input[type=date]')) push({ type: 'input', sel: selOf(el), tag: 'input', value: el.value });
    }, true);

    // 传图：记录压缩后的图片
    const origAdd = window.addFiles;
    window.addFiles = async function (id, files) {
      const before = (UPL[id] || []).length;
      await origAdd(id, files);
      if (rec) push({ type: 'upload', id, items: clone((UPL[id] || []).slice(before)) });
    };

    function start() {
      go('todo');
      rec = { version: 1, startedAt: Date.now(), me, route: clone(route), seed: clone(DB), events: [] };
      persist();
      toast('开始录制');
    }
    function mark() {
      const title = prompt('这个亮点叫什么？（可留空，之后再改）', '') ;
      if (title === null) return;
      push({ type: 'mark', title: title.trim() || `亮点 ${rec.events.filter((x) => x.type === 'mark').length + 1}` });
      toast('已标记亮点');
    }
    function exportRec() {
      const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'demo-recording.json';
      a.click();
    }
    function restart() {
      if (!confirm('清空当前录制，从头再录？')) return;
      localStorage.removeItem(REC_KEY); rec = null; paint();
    }

    const panel = document.createElement('div');
    panel.id = 'rec-panel';
    document.body.appendChild(panel);
    function paint() {
      if (!rec) {
        panel.innerHTML = `<button class="rec-btn primary" data-act="start">${icon('dot')}开始录制</button>`;
      } else {
        const marks = rec.events.filter((x) => x.type === 'mark').length;
        panel.innerHTML = `<div class="rec-state"><span class="rec-dot"></span>录制中 · ${rec.events.length} 步 · ${marks} 个亮点</div>
          <button class="rec-btn primary" data-act="mark">${icon('bookmark')}标记亮点</button>
          <button class="rec-btn" data-act="export">导出录制</button>
          <button class="rec-btn text" data-act="restart">重录</button>`;
      }
    }
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      ({ start, mark, export: exportRec, restart })[b.dataset.act]();
    });
    paint();
    return;
  }

  // =====================================================================
  //  回放模式
  // =====================================================================
  const speed = parseFloat(qs.get('speed') || '1') || 1;
  let rec = null, marks = [], pos = 0, curStep = -1, token = 0, dirty = false;
  let running = Promise.resolve();
  // 演示时观众/讲者在手机里自己点了，下次跳转就从头快进，保证画面对得上
  document.addEventListener('click', (e) => { if (e.isTrusted) dirty = true; }, true);
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  document.body.appendChild(cursor);
  document.body.classList.add('demo-replay');

  function reset() {
    DB = clone(rec.seed);
    me = rec.me;
    const us = document.getElementById('userSwitch');
    if (us) us.value = me;
    closeModal();
    document.querySelectorAll('.imgview').forEach((x) => x.remove());
    route = clone(rec.route);
    render();
    window.scrollTo(0, 0);
    pos = 0;
  }

  async function moveTo(el) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(60);
    const r = el.getBoundingClientRect();
    cursor.style.left = r.left + Math.min(r.width / 2, 40) + 'px';
    cursor.style.top = r.top + r.height / 2 + 'px';
    cursor.classList.add('show');
    await sleep(520 / speed);
  }

  async function apply(ev, animate) {
    if (ev.type === 'mark') return;
    if (ev.type === 'upload') {
      UPL[ev.id] = (UPL[ev.id] || []).concat(ev.items);
      const box = document.getElementById(ev.id + '_t');
      if (box) box.innerHTML = thumbsHtml(ev.id);
      if (animate) await sleep(300 / speed);
      return;
    }
    const el = find(ev);
    if (!el) { console.warn('[demo] 找不到元素', ev); return; }
    if (animate) await moveTo(el);
    if (ev.type === 'click') {
      if (animate) { cursor.classList.add('tap'); await sleep(140 / speed); cursor.classList.remove('tap'); }
      el.click();
    } else if (ev.type === 'input') {
      if (animate && ev.value && ev.value.length <= 40 && el.type !== 'datetime-local') {
        for (let i = 1; i <= ev.value.length; i++) { el.value = ev.value.slice(0, i); await sleep(45 / speed); }
      }
      el.value = ev.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (ev.type === 'select') {
      el.value = ev.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (animate) await sleep(380 / speed);
  }

  // 快进（无动画、不弹提示）
  function fastTo(end) {
    const origToast = window.toast;
    window.toast = () => {};
    try { while (pos < end) apply(rec.events[pos++], false); }
    finally { window.toast = origToast; }
  }

  function goto(step) {
    const my = ++token;
    running = running.then(() => (my === token ? doGoto(step, my) : null)).catch((e) => console.warn(e));
  }

  async function doGoto(step, my) {
    step = Math.max(0, Math.min(step, marks.length - 1));
    const end = marks[step] + 1;
    if (end < pos || curStep < 0 || dirty) {
      dirty = false;
      // 往回跳或首次进入：从头快进到上一个亮点，再动画播放这一段
      reset();
      fastTo(step > 0 ? marks[step - 1] + 1 : 0);
    }
    curStep = step;
    cursor.classList.remove('show');
    while (pos < end) {
      if (my !== token) return; // 被新的跳转打断
      await apply(rec.events[pos++], true);
    }
    cursor.classList.remove('show');
    parent.postMessage({ type: 'demo-at', step }, '*');
  }

  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === 'demo-goto' && rec) goto(+d.step || 0);
  });

  fetch(qs.get('replay')).then((r) => r.json()).then((data) => {
    rec = data;
    marks = rec.events.map((x, i) => (x.type === 'mark' ? i : -1)).filter((i) => i >= 0);
    if (!marks.length) marks = [rec.events.length - 1];
    reset();
    parent.postMessage({ type: 'demo-ready', steps: rec.events.filter((x) => x.type === 'mark').map((x) => x.title) }, '*');
    if (parent === window) goto(+(qs.get('step') || 0)); // 单独打开时直接播放
  });
})();
