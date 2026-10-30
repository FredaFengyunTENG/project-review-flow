// ===== 页面视图（精美、少字、点选为主、服务型）=====

let memberState = [];
let pickedClauseState = ''; // 当前选中的条款代码，如 '第十二条第(二)款'

function render() {
  updateTopBadges();

  const todoBtn = $('#tabbar button[data-go="todo"]');
  if (todoBtn) {
    if (U(me).role === '院长') todoBtn.textContent = '院长看板';
    else if (U(me).role === '院总') todoBtn.textContent = '院总看板';
    else if (U(me).role === '所长') todoBtn.textContent = `${U(me).dept || '本所'}看板`;
    else todoBtn.textContent = '待办';
  }

  $$('#tabbar button').forEach((b) => {
    const isDeanSub = (route.name === 'dean-meetings' || route.name === 'dean-notes') && b.dataset.go === 'todo';
    const isCeSub = (route.name === 'ce-reviews' || route.name === 'ce-upcoming' || route.name === 'ce-issues') && b.dataset.go === 'todo';
    b.classList.toggle('on', b.dataset.go === route.name || isDeanSub || isCeSub);
  });

  const v = $('#view');
  lastUpl = null;
  if (route.name === 'todo') {
    if (U(me).role === '院长') v.innerHTML = viewDeanBoard();
    else if (U(me).role === '院总') v.innerHTML = viewChiefEngineerBoard();
    else if (U(me).role === '所长') v.innerHTML = viewDirectorBoard();
    else v.innerHTML = viewTodo();
  }
  else if (route.name === 'dean-meetings') v.innerHTML = viewDeanMeetings();
  else if (route.name === 'dean-notes') v.innerHTML = viewDeanNotes();
  else if (route.name === 'ce-reviews') v.innerHTML = viewChiefEngineerReviews();
  else if (route.name === 'ce-upcoming') v.innerHTML = viewChiefEngineerUpcoming();
  else if (route.name === 'ce-issues') v.innerHTML = viewChiefEngineerIssues();
  else if (route.name === 'projects') v.innerHTML = viewProjects();
  else if (route.name === 'new') { v.innerHTML = viewNew(); bindNew(); }
  else if (route.name === 'project') v.innerHTML = viewProject(P(route.arg));
}

// 状态标签：进行（蓝）/ 已完成（绿）/ 待处理（中性灰）
function statusTag(it) {
  if (it.status === 'done') return '<span class="tag done">已通过</span>';
  if (it.status === 'known') return '<span class="tag done">已阅知</span>';
  if (it.status === 'holding') return '<span class="tag progress">待把关</span>';
  if (it.status === 'accepted') return `<span class="tag progress">已接收${it.appointment ? ' · 约' + fmtAppt(it.appointment) : ''}</span>`;
  return '<span class="tag">待审查</span>';
}

// 类别不是状态，统一中性灰，保持色彩克制
function catTag(cat) {
  return `<span class="tag">${esc(cat)}</span>`;
}

const sectionTitle = (text, count) => `<h2>${text}${count !== undefined ? `<span class="count">${count}</span>` : ''}</h2>`;
const backBar = (label, right = '') => `<div class="page-head">
    <button class="btn sm text neutral" onclick="go('todo')">${icon('arrow-left')}${label}</button>
    ${right}
  </div>`;

// 流程精简直观步进指示（显眼位置呈现）
function miniFlowHtml(p) {
  const keys = path(p);
  const curIdx = p.stageIdx;
  return `
    <div class="mini-flow">
      ${keys.map((k, i) => {
        const meta = stageMeta(p, k);
        const isDone = i < curIdx;
        const isCur = i === curIdx;
        const isMeeting = meta.type === 'meeting';
        const cls = isDone ? 'done' : isCur ? (isMeeting ? 'wait' : 'cur') : '';
        const ico = isDone ? icon('check', 'i-sm') : isCur ? (isMeeting ? icon('clock', 'i-sm') : icon('dot', 'i-sm')) : '';
        const arrow = i < keys.length - 1 ? `<span class="mini-step-arrow">${icon('chevron-right', 'i-sm')}</span>` : '';
        return `<span class="mini-step ${cls}">${ico}${esc(meta.name)}</span>${arrow}`;
      }).join('')}
    </div>`;
}

// ===== 待办主页（规划师一线视角：聚焦当前行动、显眼流程、等会并联提醒）=====
function viewTodo() {
  let h = '';

  // 1. 待我审查
  const tasks = myReviewTasks();
  h += sectionTitle('待我审查', tasks.length);
  h += tasks.length ? tasks.map(({ p, r, it }) => `
    <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row nowrap">
        <span class="title">${esc(p.alias || p.name)}</span>
        ${statusTag(it)}
      </div>
      <div class="muted card-meta">${p.dept || '规划一所'} · ${stageMeta(p, r.stage).name} · ${uname(p.leader)} 送审</div>
      ${r.parallel ? `<div class="mt-2"><span class="tag danger">加急：${esc(r.reason)}</span></div>` : ''}
    </div>`).join('') : `<div class="card empty">${icon('inbox')}暂无待审事项</div>`;

  // 2. 我参与的进行中项目（显眼展示流程与并联推进）
  const mine = DB.projects.filter((p) => p.members.includes(me) && !finished(p));
  h += sectionTitle('进行中的项目', mine.length);
  h += mine.length ? mine.map((p) => {
    const curK = curStage(p);
    const def = stageMeta(p, curK);
    const sCur = p.stages[curK] || {};

    let meetingBadge = '';
    if (sCur.apply) {
      if (sCur.apply.status === 'scheduled') {
        meetingBadge = `<span class="tag wait">${icon('calendar', 'i-sm')}开会 ${fmtAppt(sCur.apply.scheduledTime)}</span>`;
      } else {
        meetingBadge = `<span class="tag wait">已报会 · 等开会</span>`;
      }
    }

    // 等上会时的下一阶段成果审查提醒
    let parallelTip = '';
    if (def && def.type === 'meeting') {
      const nextKey = path(p)[p.stageIdx + 1];
      if (nextKey) {
        const nextDef = stageMeta(p, nextKey);
        if (nextDef && nextDef.type === 'review') {
          const nextReviews = (p.reviews || []).filter((r) => r.stage === nextKey);
          const nextDone = nextReviews.length && nextReviews.every((r) => r.items.every((it) => it.status === 'done' || it.status === 'known'));
          if (nextDone) {
            parallelTip = `<div class="parallel-tip">${icon('check-circle', 'i-sm')}下一阶段「${esc(nextDef.name)}」成果已提前审查就绪</div>`;
          } else if (nextReviews.length) {
            parallelTip = `<div class="parallel-tip">${icon('zap', 'i-sm')}正在提前审查下一阶段「${esc(nextDef.name)}」成果</div>`;
          } else {
            parallelTip = `<div class="parallel-tip">${icon('zap', 'i-sm')}等会不等人：可同步送审「${esc(nextDef.name)}」成果</div>`;
          }
        }
      }
    }

    return `<div class="card click" onclick="go('project','${p.id}')">
      <div class="row">
        <span class="title">${esc(p.alias || p.name)}</span>
        <div class="hstack tight">
          ${catTag(p.category)}
          ${meetingBadge}
        </div>
      </div>
      ${miniFlowHtml(p)}
      ${parallelTip}
    </div>`;
  }).join('') : '<div class="card empty">暂无进行中的项目</div>';

  return h;
}

// ===== 项目列表（全院台账库：支持分类筛选）=====
let projectFilterCat = 'all';
function setProjectFilter(cat) {
  projectFilterCat = cat;
  render();
}

function viewProjects() {
  const allList = DB.projects.filter((p) => canSee(p, me));
  const filterCats = ['all', '正向优化', '技术修正', '控规优化调整', '控规修改', '控规', 'finished'];
  const labels = {
    all: '全部',
    '正向优化': '正向优化',
    '技术修正': '技术修正',
    '控规优化调整': '优化调整',
    '控规修改': '控规修改',
    '控规': '控规',
    finished: '已结项'
  };

  const list = allList.filter((p) => {
    if (projectFilterCat === 'all') return true;
    if (projectFilterCat === 'finished') return finished(p);
    return p.category === projectFilterCat && !finished(p);
  });

  return `
    ${sectionTitle('项目台账', allList.length)}

    <!-- 分类筛选轻量标签栏 -->
    <div class="filter-bar">
      ${filterCats.map((c) => {
        const count = allList.filter((p) => c === 'all' ? true : c === 'finished' ? finished(p) : p.category === c && !finished(p)).length;
        return `<span class="chip ${projectFilterCat === c ? 'on' : ''}" onclick="setProjectFilter('${c}')">${labels[c]}<span class="faint">${count}</span></span>`;
      }).join('')}
    </div>

    ${list.length ? list.map((p) => `
      <div class="card click" onclick="go('project','${p.id}')">
        <div class="row nowrap">
          <span class="title">${esc(p.alias || p.name)}</span>
          ${catTag(p.category)}
        </div>
        <div class="muted card-meta">${esc(p.name)}</div>
        ${miniFlowHtml(p)}
        <div class="faint mt-2">负责人：${uname(p.leader)} · ${finished(p) ? '<span class="text-done">已结项</span>' : '当前：' + (curStage(p) ? stageMeta(p, curStage(p)).name : '—')}</div>
      </div>`).join('') : '<div class="card empty">暂无该分类项目</div>'}
    <button class="btn text neutral block mt-4" onclick="resetDemo()">重置示例数据</button>
  `;
}

// ===== 修改依据选择器：只点选第几款，界面不写具体情形（条文原文在「查看原文」里看）=====
function clauseShort(code) {
  const m = /第(\([一二三四五六七八九十]+\))[款项]$/.exec(code || '');
  return m ? m[1] : code;
}

function clausePickerHtml(cat, curVal = '') {
  const items = CLAUSE_ITEMS[cat];
  if (!items || !items.length) return '';
  const codes = items.map(([code]) => code);
  const cand = curVal || pickedClauseState;
  const picked = codes.includes(cand) ? cand : codes[0];
  pickedClauseState = picked;
  const src = CLAUSE_SOURCE[cat] || {};

  return `
    <div id="clause_container">
      <label class="f">修改依据 <span class="faint">${esc(src.short || '')}</span></label>
      <div class="chips clause-chips">
        ${codes.map((code) => `<span class="chip ${code === picked ? 'on' : ''}" onclick="selectClause('${esc(code)}','${esc(cat)}')">${esc(clauseShort(code))}</span>`).join('')}
      </div>
      <input type="hidden" id="c_clause_val" value="${esc(picked)}">
      ${src.pdf ? `<a class="btn sm text clause-src" href="${esc(src.pdf)}" target="_blank" rel="noopener">${icon('file-text', 'i-sm')}查看原文</a>` : ''}
    </div>`;
}

function selectClause(code, cat) {
  pickedClauseState = code;
  const c = $('#clause_container');
  if (c) c.outerHTML = clausePickerHtml(cat, code);
}

// 针对不同类别的图件与指标栏位规则：
// 正向优化：优化前用地图（可+指标表）、优化后用地图（可+指标表）
// 技术修正：修正前用地图（可+指标表）、修正后用地图（可+指标表）
// 控规修改：修改前用地图（可+指标表）、修改后用地图（可+指标表）
// 控规优化调整：调整前用地图（可+指标表）、调整后（新编控规）用地图、新编控规指标表
// 控规新编：用地图、指标表
function categorySchemeLabels(cat) {
  if (cat === '正向优化') {
    return [
      { key: 'a', title: '优化前用地图（可+指标表）' },
      { key: 'b', title: '优化后用地图（可+指标表）' },
    ];
  }
  if (cat === '技术修正') {
    return [
      { key: 'a', title: '修正前用地图（可+指标表）' },
      { key: 'b', title: '修正后用地图（可+指标表）' },
    ];
  }
  if (cat === '控规修改') {
    return [
      { key: 'a', title: '修改前用地图（可+指标表）' },
      { key: 'b', title: '修改后用地图（可+指标表）' },
    ];
  }
  if (cat === '控规优化调整') {
    return [
      { key: 'a', title: '调整前用地图（可+指标表）' },
      { key: 'b', title: '调整后（新编控规）用地图' },
      { key: 'c', title: '新编控规指标表' },
    ];
  }
  return [
    { key: 'a', title: '用地图' },
    { key: 'b', title: '指标表' },
  ];
}

function contentFields(cat, v = {}) {
  if (cat === '其他（待开发）') {
    return `<div class="empty">专项规划等其他类型正在开发中...</div>`;
  }
  const imgs = v.imgs || {};
  const curClause = v.clause || '';
  const labels = categorySchemeLabels(cat);
  const is3 = labels.length === 3;

  return `
    ${clausePickerHtml(cat, curClause)}
    <div class="upl-grid ${is3 ? 'cols-3' : ''}">
      ${labels.map((item) => uploader('c_' + item.key, imgs[item.key] || [], item.title)).join('')}
    </div>`;
}

function readContent() {
  return {
    clause: $('#c_clause_val')?.value || pickedClauseState || '',
    imgs: {
      a: [...(UPL.c_a || [])],
      b: [...(UPL.c_b || [])],
      c: [...(UPL.c_c || [])],
    },
  };
}

// ===== 新建项目视图（精美、字少、快捷选人）=====
function viewNew() {
  return `${sectionTitle('新建项目')}
  <div class="card">
    <label class="f">项目类别</label>
    ${chips('n_cat', CATEGORIES.map((c) => [c, c]), ['控规优化调整'], true)}
    <div id="n_catTip" class="muted mt-2"></div>

    <label class="f">项目正式名称</label>
    <input type="text" id="n_name" placeholder="输入名称或粘贴截图">
    <div class="upl-wrap">${uploader('n_nameImg')}</div>

    <label class="f">俗称（简称）</label>
    <input type="text" id="n_alias" placeholder="如：东湖地块 / 滨江商务区">

    <div id="n_pubBox" class="hidden">
      <label class="f">公示节点（控规修改）</label>
      ${chips('n_pub', [['after', '联审会后'], ['before', '联审会前']], ['after'], true)}
    </div>
  </div>

  <div id="n_rest">
    <div class="card">
      ${memberFieldHtml([me])}
      <label class="f">公开给谁看</label>
      ${visibleFieldHtml()}
    </div>

    ${sectionTitle('方案图件与依据')}
    <div class="card" id="n_content"></div>

    <button class="btn block mt-4" onclick="doCreate()">创建项目</button>
  </div>`;
}

function bindNew() {
  renderMemberBadges();
  const tips = {
    '正向优化': '快速通道 · 联审后由局长办公会审核审定入库',
    '技术修正': '常态化微调 · 联审后直接盖章入库',
    '控规优化调整': '优化调整与新编控规合并走流程，只公示一次',
    '控规修改': '重大变更 · 论证与新编两轮进行',
    '控规': '详细规划新编标准流程',
  };

  const upd = () => {
    const cat = picked('#n_cat')[0] || '控规优化调整';
    const isOther = cat === '其他（待开发）';
    pickedClauseState = '';
    $('#n_catTip').textContent = tips[cat] || '';
    $('#n_pubBox').classList.toggle('hidden', cat !== '控规修改');
    $('#n_content').innerHTML = contentFields(cat);
    $('#n_rest').classList.toggle('hidden', isOther);
  };
  $('#n_cat')?.addEventListener('change', upd);
  upd();
}

function doCreate() {
  const category = picked('#n_cat')[0];
  if (category === '其他（待开发）') return toast('该类型暂未开放');
  const nameImgs = [...(UPL.n_nameImg || [])];
  const name = $('#n_name')?.value.trim() || (nameImgs.length ? '（见名称截图）' : '');
  if (!name) return toast('请填写名称或粘贴截图');
  if (!memberState.length) return toast('请添加至少一位成员');
  const visible = VIS_ROLES.flatMap((r) => picked('#n_v_' + (ROLE_KEYS[r] || r)));
  createProject({
    category,
    name,
    nameImgs,
    alias: $('#n_alias')?.value.trim(),
    publicity: picked('#n_pub')[0] || 'after',
    leader: memberState[0],
    members: memberState,
    visible,
    version: readContent(),
  });
}

// ===== 方案内容卡片（极简：展示条文代码 + 分类用地图与指标）=====
function renderSchemeCard(p) {
  const vs = p.versions;
  const isMulti = vs.length > 1;
  const cur = vs[vs.length - 1];
  const labels = categorySchemeLabels(p.category);
  const is3 = labels.length === 3;

  const bodyHtml = (v, isOld) => {
    const imgs = v.imgs || {};
    return `
      <div class="ver ${!isMulti ? 'single' : isOld ? 'old' : ''}">
        ${isMulti ? `<div class="row mb-2"><b>第 ${v.no} 版</b><span class="faint">${v.at} · ${uname(v.by)}</span></div>` : ''}
        ${isMulti && v.note ? `<div class="note">${esc(v.note)}</div>` : ''}
        ${v.clause ? `<div class="clause-line"><span class="tag progress">${icon('bookmark', 'i-sm')}${esc(v.clause)}</span></div>` : ''}
        <div class="scheme-pair ${is3 ? 'cols-3' : ''}">
          ${labels.map((item) => `
            <div class="scheme-box">
              <div class="lbl">${esc(item.title)}</div>
              ${imgsHtml(imgs[item.key]) || '<span class="faint">—</span>'}
            </div>
          `).join('')}
        </div>
      </div>`;
  };

  return `<div class="card">
    ${bodyHtml(cur, false)}
    ${isMulti ? `<details><summary>历史方案 (${vs.length - 1} 个早期版本)</summary>${vs.slice(0, -1).reverse().map((v) => bodyHtml(v, true)).join('')}</details>` : ''}
  </div>`;
}

// 等上会时：并联推进下一阶段成果审查（例如：等联审会可提前审查批前公示，等市长会可提前审查报批成果）
function renderParallelAdvance(p, cur) {
  const nextKey = path(p)[p.stageIdx + 1];
  if (!nextKey) return '';
  const nextDef = stageMeta(p, nextKey);
  if (!nextDef || nextDef.type !== 'review') return '';

  const nextReviews = (p.reviews || []).filter((r) => r.stage === nextKey);
  const isDone = nextReviews.length && nextReviews.every((r) => r.items.every((it) => it.status === 'done' || it.status === 'known'));

  if (isDone) {
    return `
      <div class="parallel-box ready">
        <div class="row nowrap">
          <span class="p-title">${icon('check-circle')}下一阶段「${esc(nextDef.name)}」已提前把关通过</span>
          <span class="tag done">已就绪</span>
        </div>
        <div class="p-desc">会后记录结果即可直接进入公示/入库，省去重复等待周期。</div>
      </div>`;
  }
  if (nextReviews.length) {
    return `
      <div class="parallel-box">
        <div class="row nowrap">
          <span class="p-title">${icon('zap')}下一阶段「${esc(nextDef.name)}」提前把关中</span>
          <span class="tag parallel">并联把关中</span>
        </div>
        <div class="p-desc">
          正在把关：${nextReviews[0].items.map((i) => uname(i.uid) + '（' + (i.status === 'done' || i.status === 'known' ? '已过' : '审查中') + '）').join('、')}
        </div>
      </div>`;
  }
  return `
    <div class="parallel-box">
      <div class="row nowrap">
        <span class="p-title">${icon('zap')}并联提效 · 等会不等人</span>
        <span class="tag parallel">建议推进</span>
      </div>
      <div class="p-desc">
        当前在等开会排期，可同步提前送审下一阶段<b>「${esc(nextDef.name)}」</b>（${nextDef.forms ? nextDef.forms.join('、') : '成果材料'}），开完会即可直接放行。
      </div>
      <button class="btn sm parallel" onclick="reviewModal('${p.id}','${nextKey}')">${icon('send')}提前送审「${esc(nextDef.name)}」成果</button>
    </div>`;
}

// ===== 项目详情页（精简、去AI腔调、报会不阻塞、少打字）=====
function viewProject(p) {
  if (!p) return '<div class="empty">项目不存在</div>';
  if (!canSee(p, me)) return `<div class="empty">${icon('lock')}你不在该项目的公开范围内</div>`;
  const keys = path(p), cur = curStage(p), def = stageMeta(p, cur), team = isTeam(p);
  const sCur = p.stages[cur] || {};
  const isApplied = !!sCur.apply;
  const isScheduled = isApplied && sCur.apply.status === 'scheduled';

  // 当前阶段动作卡片（无AI用语，直接呈现动作按钮；每张卡只一个主按钮）
  let stageCard = '';
  if (team) {
    const moreBtn = `<button class="icon-more-btn" onclick="stageMoreMenuModal('${p.id}')" title="更多操作" aria-label="更多操作">${icon('more', 'i-lg')}</button>`;
    const cardFoot = `<div class="card-foot">
          <button class="btn sm text" onclick="versionModal('${p.id}')">${icon('plus')}传新版方案</button>
          ${moreBtn}
        </div>`;

    if (finished(p)) {
      stageCard = `<div class="card stage-card is-done">
        <div class="row nowrap">
          <span class="stage-name text-done hstack tight">${icon('check-circle')}全部审查及入库流程已结项</span>
          ${moreBtn}
        </div>
      </div>`;
    } else if (cur === 's2' || def.name.includes('技术审查会')) {
      // 分院技术审查会：一键报会、绝不阻塞，随时可推进评审审查
      stageCard = `<div class="card stage-card is-wait">
        <div class="row nowrap">
          <span class="stage-name">${esc(def.name)}</span>
          ${isScheduled ? '<span class="tag wait">已排期</span>' : isApplied ? '<span class="tag wait">已报会</span>' : '<span class="tag">未报会</span>'}
        </div>

        ${isScheduled ? `
          <div class="info-box wait">${icon('calendar', 'i-sm')}已排期：${fmtAppt(sCur.apply.scheduledTime)} · ${esc(sCur.apply.location || '三楼大会议室')}</div>` : ''}

        <div class="stage-actions">
          ${!isApplied ? `
            <button class="btn block" onclick="oneTapApplyMeeting('${p.id}','${cur}')">${icon('calendar')}一键报会（报给院长凑会）</button>
            <button class="btn text block" onclick="completeStage(P('${p.id}'), true)">不上会，直接进入评审审查${icon('arrow-right')}</button>
          ` : `
            <button class="btn block" onclick="completeStage(P('${p.id}'))">进入评审审查（不等开会直接推）${icon('arrow-right')}</button>
            <button class="btn ghost block" onclick="meetingModal('${p.id}','${cur}')">${icon('file-text')}记会议结果</button>
          `}
        </div>

        ${renderParallelAdvance(p, cur)}
        ${cardFoot}
      </div>`;
    } else if (def.type === 'meeting') {
      // 其他会议阶段（联审会、局长办公会、市政府会）：未记会议时主按钮为"记录"，记完后主按钮为"完成"
      const hasMeeting = !!sCur.meeting;
      stageCard = `<div class="card stage-card is-wait">
        <div class="row nowrap">
          <span class="stage-name">${esc(def.name)}</span>
          <span class="tag wait">会议节点</span>
        </div>
        <div class="stage-actions">
          <button class="btn ${hasMeeting ? 'ghost' : ''} block" onclick="meetingModal('${p.id}','${cur}')">${icon('file-text')}记录会议信息</button>
          <button class="btn ${hasMeeting ? '' : 'ghost'} block" onclick="completeStage(P('${p.id}'))">完成本阶段，进入下一步${icon('arrow-right')}</button>
          ${def.preReview ? `<button class="btn text block" onclick="reviewModal('${p.id}')">${icon('send')}发起会前预审</button>` : ''}
        </div>

        ${renderParallelAdvance(p, cur)}
        ${cardFoot}
      </div>`;
    } else {
      // 审查节点
      const stageReviews = p.reviews.filter((r) => r.stage === cur);
      let reviewAction = '';

      if (!stageReviews.length) {
        reviewAction = `
          <button class="btn block" onclick="reviewModal('${p.id}')">${icon('send')}送审「${def.dual ? '两套成果' : (def.forms ? def.forms[0] : '成果')}」</button>
          ${def.optional ? `<button class="btn text block" onclick="completeStage(P('${p.id}'), true)">${esc(def.skipLabel || '跳过此阶段')}${icon('arrow-right')}</button>` : ''}`;
      } else {
        // 判定放行：
        // 1. 所有审查项均为 done 或 known
        // 2. 所长若为 pending 且非 holding，只要技术审查人（组长/所总/院总）全部完成，不卡放行
        const allDone = stageReviews.every((r) => r.items.every((it) => {
          if (it.status === 'done' || it.status === 'known') return true;
          if (U(it.uid).role === '所长' && it.status !== 'holding') {
            const techItems = r.items.filter((x) => U(x.uid).role !== '所长');
            return !techItems.length || techItems.every((x) => x.status === 'done');
          }
          return false;
        }));

        const statusBadges = stageReviews.flatMap((r) => r.items.map((it) => {
          const u = U(it.uid);
          if (u.role === '所长') {
            if (it.status === 'known') return `<span class="tag done">${icon('check', 'i-sm')}${uname(it.uid)}（已阅知）</span>`;
            if (it.status === 'holding') return `<span class="tag progress">${icon('clock', 'i-sm')}${uname(it.uid)}（待所长把关中）</span>`;
            if (it.status === 'done') return `<span class="tag done">${icon('check', 'i-sm')}${uname(it.uid)}（把关完成）</span>`;
            return `<span class="tag">${uname(it.uid)}（知晓中）</span>`;
          }
          if (it.status === 'done') return `<span class="tag done">${icon('check', 'i-sm')}${uname(it.uid)}（${u.role === '组长' || u.role === '所总' ? '审查校对通过' : '审查通过'}）</span>`;
          if (it.status === 'accepted') return `<span class="tag progress">${icon('calendar', 'i-sm')}${uname(it.uid)}（已约送册）</span>`;
          return `<span class="tag">${icon('clock', 'i-sm')}${uname(it.uid)}（审查中）</span>`;
        }));

        let directorQuickActions = '';
        if (U(me).role === '所长') {
          const curReview = stageReviews[stageReviews.length - 1];
          const myItem = curReview?.items.find((i) => i.uid === me);
          if (myItem?.status !== 'done') {
            directorQuickActions = `
              <div class="director-pick">
                <div class="muted">所长把关选择</div>
                <div class="btn-row">
                  <button class="btn sm ghost" onclick="directorAcknowledge('${p.id}','${curReview.id}')" title="知晓直接放行，不卡后续流程">${icon('eye')}一键阅知</button>
                  <button class="btn sm ghost" onclick="directorHold('${p.id}','${curReview.id}')" title="设为待我把关，亲自审查提意见">${icon('shield-check')}待我把关</button>
                </div>
              </div>`;
          }
        }

        if (allDone) {
          reviewAction = `
            <div class="tags">${statusBadges.join('')}</div>
            <div class="status-line done">${icon('check-circle')}审查流程已满足进入下一阶段条件</div>
            ${directorQuickActions}
            <div class="stage-actions">
              <button class="btn block" onclick="completeStage(P('${p.id}'))">进入下一阶段${icon('arrow-right')}</button>
              <button class="btn text block" onclick="reviewModal('${p.id}')">${icon('plus')}追加送审其他人</button>
            </div>`;
        } else {
          const waitingNames = stageReviews.flatMap((r) => r.items.filter((it) => {
            if (it.status === 'done' || it.status === 'known') return false;
            return true;
          })).map((i) => uname(i.uid));

          reviewAction = `
            <div class="tags">${statusBadges.join('')}</div>
            <div class="status-line">正在等待<b>${waitingNames.join('、')}</b>把关</div>
            ${directorQuickActions}
            <div class="btn-row">
              <button class="btn sm text" onclick="reviewModal('${p.id}')">${icon('plus')}追加送审</button>
              <button class="btn sm ghost" onclick="completeStage(P('${p.id}'))">直接进入下一阶段${icon('arrow-right')}</button>
            </div>`;
        }
      }

      stageCard = `<div class="card stage-card">
        <div class="row nowrap">
          <span class="stage-name">${esc(def.name)}</span>
          <span class="tag progress">审查节点</span>
        </div>
        <div class="stage-actions">${reviewAction}</div>
        ${cardFoot}
      </div>`;
    }
  }

  const otherMembers = p.members.filter((m) => m !== p.leader);

  return `<div class="card">
    <div class="title">${esc(p.alias || p.name)}</div>
    ${p.alias && p.alias !== p.name ? `<div class="muted card-meta">${esc(p.name)}</div>` : ''}
    ${imgsHtml(p.nameImgs)}
    <div class="tags mt-3">
      <span class="tag">${p.dept || '规划一所'}</span>
      ${catTag(p.category)}
    </div>
    <div class="muted mt-3">
      负责人：<b>${uname(p.leader)}</b>${otherMembers.length ? ' · 成员：' + otherMembers.map(uname).join('、') : ''}
    </div>
    <div class="faint mt-1">公开：${p.visible.map(uname).join('、')}</div>
  </div>

  ${stageCard}

  ${sectionTitle('方案图件与依据')}
  ${renderSchemeCard(p)}

  ${sectionTitle('流程进度')}
  <div class="card">
    <ul class="timeline">
      ${keys.map((k, i) => {
        const s = p.stages[k] || {};
        const m = stageMeta(p, k);
        const cls = s.skipped ? 'skip' : i < p.stageIdx ? 'done' : i === p.stageIdx ? ('cur' + (m.type === 'meeting' ? ' wait' : '')) : '';
        return `<li class="${cls}">
          <span class="sname">${esc(m.name)}</span>
          ${m.optional ? '<span class="tag">可选</span>' : ''}
          ${stageDetail(p, k)}
        </li>`;
      }).join('')}
    </ul>
    <div class="timeline-foot">
      <span class="edit-link" onclick="historyModal('${p.id}')">${icon('history', 'i-sm')}查看完整操作记录 (${p.log.length})</span>
    </div>
  </div>`;
}

// 阶段详情卡片
function stageDetail(p, key) {
  const s = p.stages[key] || {};
  let h = '';

  if (s.apply) {
    const ap = s.apply;
    h += `<div class="opinion meeting">
      <div class="row">
        <b>分院审查会报会</b>
        <span class="tag wait">${ap.status === 'scheduled' ? '已排期' : '已报会'}</span>
      </div>
      <div class="muted mt-1">报会人：${uname(ap.applicant || p.leader)} · ${ap.submittedAt || ''}</div>
      ${ap.scheduledTime ? `<div class="meet-line">${icon('calendar', 'i-sm')}开会：${fmtAppt(ap.scheduledTime)} · ${esc(ap.location || '三楼大会议室')}</div>` : ''}
      ${U(me).role === '院长' && ap.status === 'pending' ? `<div class="hstack mt-2"><button class="btn sm ml-auto" onclick="deanScheduleModal('${p.id}','${key}')">排定会议</button></div>` : ''}
    </div>`;
  }

  if (s.meeting) {
    const m = s.meeting;
    h += `<div class="opinion meeting">
      <div class="meet-line">${icon('calendar', 'i-sm')}<b>${fmtAppt(m.time) || '已开会'}</b> · ${esc(m.opinion || '原则通过')}</div>
      ${m.location ? `<div class="muted mt-1">地点：${esc(m.location)}</div>` : ''}
      ${m.implement ? `<div class="mt-1">${esc(m.implement)}</div>` : ''}
      <div>${imgsHtml(m.photos)}</div>
    </div>`;
  }

  p.reviews.filter((r) => r.stage === key).forEach((r) => {
    r.items.forEach((it) => {
      h += `<div class="stage-item">
        <div class="row">
          <span><b>${uname(it.uid)}</b> <small class="faint">(${U(it.uid).role})</small></span>
          ${statusTag(it)}
        </div>
        ${fbSummary(it.feedback)}
      </div>`;
    });
  });

  return h;
}

function fbSummary(f) {
  if (!f) return '';
  if (f.quick) return `<div class="opinion">${esc(f.quick)}</div>`;
  return `<div class="opinion">
    ${f.dataErr ? `数据错误 <b>${f.dataErr}</b> 处 ` : ''}${f.textErr ? `文字错误 <b>${f.textErr}</b> 处 ` : ''}
    ${f.key ? `<div>${esc(f.key)}</div>` : ''}
    <div>${imgsHtml(f.photos)}</div>
  </div>`;
}

// ===== 王院长看板（微调字数、点选排期与直通车）=====
function viewDeanBoard() {
  const applies = deanPendingApplies();
  const notes = deanPendingNotes();
  const total = DB.projects.length;

  return `
    <div class="card">
      <div class="board-head">
        <span class="title">${icon('dashboard')}王院长看板</span>
        <span class="tag">全院 ${total} 项</span>
      </div>
    </div>

    ${sectionTitle('待办事项')}
    <div class="card click" onclick="go('dean-meetings')">
      <div class="row nowrap">
        <span class="title">分院技术审查会报会</span>
        <span class="tag ${applies.length ? 'wait' : ''}">${applies.length} 项待排期</span>
      </div>
      <div class="muted card-meta">${applies.length ? applies.map(({ p }) => esc(p.alias || p.name)).join('、') : '暂无待排期报会'}</div>
    </div>

    <div class="card click" onclick="go('dean-notes')">
      <div class="row nowrap">
        <span class="title">院长直通车留言</span>
        <span class="tag ${notes.length ? 'progress' : ''}">${notes.length} 条待回复</span>
      </div>
      <div class="muted card-meta">${notes.length ? notes.map(({ p, note }) => `${esc(p.alias || p.name)} (${esc(note.topic || '请示')})`).join('、') : '暂无待回复留言'}</div>
    </div>
  `;
}

function viewDeanMeetings() {
  const applies = deanPendingApplies();
  return `
    ${backBar('返回看板', '<span class="muted">分院技术审查会排期</span>')}

    ${applies.length >= 2 ? `
      <div class="card stage-card is-wait">
        <div class="row">
          <span><b>已达集中开会建议量</b> <span class="faint">${applies.length} 项</span></span>
          <button class="btn sm" onclick="deanBatchScheduleModal()">一键合并排期</button>
        </div>
      </div>` : ''}

    ${!applies.length ? '<div class="empty">暂无待开会的报会申请</div>' : applies.map(({ p, key, apply }) => `
      <div class="card">
        <div class="row nowrap">
          <span class="title">${esc(p.alias || p.name)}</span>
          <span class="tag">${p.dept || '规划一所'}</span>
        </div>
        <div class="muted card-meta">报会人：${uname(apply.applicant || p.leader)} · ${apply.submittedAt || ''}</div>
        <div class="card-foot">
          <span class="edit-link" onclick="go('project','${p.id}')">查看项目${icon('arrow-right', 'i-sm')}</span>
          <button class="btn sm ${applies.length >= 2 ? 'ghost' : ''}" onclick="deanScheduleModal('${p.id}','${key}')">排定时间</button>
        </div>
      </div>`).join('')}
  `;
}

function viewDeanNotes() {
  const notes = deanPendingNotes();
  return `
    ${backBar('返回看板', '<span class="muted">院长直通车留言</span>')}

    ${!notes.length ? '<div class="empty">暂无待回复直通车留言</div>' : notes.map(({ p, note }) => `
      <div class="card">
        <div class="row nowrap">
          <span class="title">${esc(p.alias || p.name)} · ${esc(note.topic || '请示')}</span>
          ${note.urgent ? '<span class="tag danger">加急</span>' : ''}
        </div>
        <div class="muted card-meta">来自：${uname(note.by)} · ${note.at}</div>
        ${note.text ? `<div class="info-box">${esc(note.text)}</div>` : ''}
        <div class="card-foot">
          <span></span>
          <button class="btn sm" onclick="deanReplyNoteModal('${p.id}','${note.id}')">回复预约时间</button>
        </div>
      </div>`).join('')}
  `;
}

// ===== 李院总看板 =====
function viewChiefEngineerBoard() {
  const myTasks = myReviewTasks();
  const issues = DB.commonIssues || [];

  return `
    <div class="card">
      <div class="board-head">
        <span class="title">${icon('landmark')}李院总看板</span>
        <span class="tag">把关大盘</span>
      </div>
    </div>

    ${sectionTitle('待办事项')}
    <div class="card click" onclick="go('ce-reviews')">
      <div class="row nowrap">
        <span class="title">待我技术把关审查</span>
        <span class="tag ${myTasks.length ? 'progress' : ''}">${myTasks.length} 项</span>
      </div>
    </div>

    <div class="card click" onclick="go('ce-issues')">
      <div class="row nowrap">
        <span class="title">共性技术问题收集板</span>
        <span class="tag">${issues.length} 条</span>
      </div>
    </div>
  `;
}

function viewChiefEngineerReviews() {
  const tasks = myReviewTasks();
  return `
    ${backBar('返回院总看板', '<span class="muted">待审成果</span>')}
    ${!tasks.length ? `<div class="empty">${icon('inbox')}暂无待审成果</div>` : tasks.map(({ p, r, it }) => `
      <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
        <div class="row nowrap">
          <span class="title">${esc(p.alias || p.name)}</span>
          ${statusTag(it)}
        </div>
        <div class="muted card-meta">${p.dept || '规划一所'} · ${stageMeta(p, r.stage).name} · ${uname(p.leader)} 送审</div>
        ${r.parallel ? `<div class="mt-2"><span class="tag danger">加急：${esc(r.reason)}</span></div>` : ''}
      </div>`).join('')}
  `;
}

function viewChiefEngineerUpcoming() { return viewChiefEngineerReviews(); }

function viewChiefEngineerIssues() {
  const issues = DB.commonIssues || [];
  return `
    ${backBar('返回院总看板', `<button class="btn sm" onclick="newIssueModal()">${icon('plus')}新增注意点</button>`)}
    ${!issues.length ? '<div class="empty">暂无共性问题</div>' : issues.map((iss) => `
      <div class="issue-card">
        <div class="row nowrap">
          <b>${esc(iss.title)}</b>
          <span class="tag">${esc(iss.category)}</span>
        </div>
        <div class="muted card-meta">${esc(iss.guide || iss.problem)}</div>
        <div class="card-foot">
          <button class="btn sm text neutral" onclick="editIssueModal('${iss.id}')">${icon('pencil')}修改</button>
          <button class="btn sm ghost" onclick="broadcastIssueModal('${iss.id}')">${icon('bell')}发布至「新规」提醒</button>
        </div>
      </div>`).join('')}
  `;
}

// ===== 所长看板 =====
function viewDirectorBoard() {
  const dept = U(me).dept || '规划一所';
  const dProjects = deptProjects(dept);
  const dirReviews = directorPendingReviews(dept);
  const applies = deptMeetingApplies(dept);
  const viewBtn = (pid, label = '查看方案') => `<button class="btn sm text" onclick="go('project','${pid}')">${label}${icon('arrow-right', 'i-sm')}</button>`;

  return `
    <div class="card">
      <div class="board-head">
        <span class="title">${icon('building')}${dept} 看板</span>
        <span class="tag">${dProjects.length} 项在编</span>
      </div>
    </div>

    ${dirReviews.length ? `
      ${sectionTitle('本所审查与把关', dirReviews.length)}
      <div class="hint mb-3">${icon('info', 'i-sm')}<span>组长/所总负责技术审查与校对；所长可点选「一键阅知」放行，或「待我把关」亲自把关。</span></div>
      ${dirReviews.map(({ p, r, it, items }) => {
        const curStatus = it ? it.status : 'pending';
        const techReviewers = items.filter((x) => U(x.uid).role === '组长' || U(x.uid).role === '所总');
        const techSummary = techReviewers.length
          ? techReviewers.map((x) => `${uname(x.uid)}（${x.status === 'done' ? '审查校对通过' : '审查中'}）`).join('、')
          : '由组长/所总负责审查校对';

        let actionArea = '';
        if (curStatus === 'known') {
          actionArea = `
            <div class="card-foot">
              <span class="tag done">${icon('check', 'i-sm')}我已阅知（放行推进）</span>
              <div class="hstack tight">
                <button class="btn sm text neutral" onclick="directorHold('${p.id}','${r.id}')">改为亲自把关</button>
                ${viewBtn(p.id)}
              </div>
            </div>`;
        } else if (curStatus === 'holding') {
          actionArea = `
            <div class="card-foot">
              <span class="tag progress">${icon('clock', 'i-sm')}待我把关中</span>
              <button class="btn sm" onclick="feedbackModal('${p.id}','${r.id}')">${icon('pencil')}填写把关意见</button>
            </div>
            <div class="row mt-2">
              <button class="btn sm text neutral" onclick="directorAcknowledge('${p.id}','${r.id}')">转为一键阅知放行</button>
              ${viewBtn(p.id)}
            </div>`;
        } else if (curStatus === 'done') {
          actionArea = `
            <div class="card-foot">
              <span class="tag done">${icon('check', 'i-sm')}我已完成把关</span>
              ${viewBtn(p.id)}
            </div>`;
        } else {
          // 未操作：两个清晰的选择（一键阅知为主操作）
          actionArea = `
            <div class="card-foot">
              <div class="hstack">
                <button class="btn sm" onclick="directorAcknowledge('${p.id}','${r.id}')" title="知晓后直接放行，不卡后续流程">${icon('eye')}一键阅知</button>
                <button class="btn sm ghost" onclick="directorHold('${p.id}','${r.id}')" title="重点项目设为待我把关，亲自审查">${icon('shield-check')}待我把关</button>
              </div>
              ${viewBtn(p.id, '查看图件')}
            </div>`;
        }

        return `
          <div class="card">
            <div class="row nowrap">
              <span class="title">${esc(p.alias || p.name)}</span>
              <span class="tag progress">${stageMeta(p, r.stage).name}</span>
            </div>
            <div class="muted card-meta">
              负责人：${uname(p.leader)} · ${esc(r.form)} · ${wayText(r)}
            </div>
            <div class="info-box">
              <b>技术把关：</b>${techSummary}
            </div>
            ${actionArea}
          </div>`;
      }).join('')}` : ''}

    ${applies.length ? `
      ${sectionTitle('本所报会追踪', applies.length)}
      ${applies.map(({ p, apply }) => `
        <div class="card click" onclick="go('project','${p.id}')">
          <div class="row nowrap">
            <span class="title">${esc(p.alias || p.name)}</span>
            <span class="tag wait">${apply.status === 'scheduled' ? '已排期' : '已报会'}</span>
          </div>
          ${apply.scheduledTime ? `<div class="muted card-meta hstack tight">${icon('calendar', 'i-sm')}开会：${fmtAppt(apply.scheduledTime)} · ${esc(apply.location || '三楼大会议室')}</div>` : ''}
        </div>`).join('')}` : ''}

    ${sectionTitle('本所项目清单')}
    ${dProjects.map((p) => `
      <div class="card click" onclick="go('project','${p.id}')">
        <div class="row nowrap">
          <span class="title">${esc(p.alias || p.name)}</span>
          ${catTag(p.category)}
        </div>
        <div class="muted card-meta">${esc(p.name)}</div>
        <div class="faint mt-1">负责人：${uname(p.leader)} · ${finished(p) ? '<span class="text-done">已结项</span>' : '当前：' + stageMeta(p, curStage(p)).name}</div>
      </div>`).join('')}
  `;
}

// ===== 成员管理组件 =====
const ROLE_KEYS = {
  '组长/所总': 'lead',
  '所长': 'director',
  '院总': 'chief_eng',
  '院长': 'dean',
};

function peopleOf(role) {
  if (role === '组长/所总') return USERS.filter((u) => u.role === '组长' || u.role === '所总').map((u) => [u.id, `${u.name}·${u.role}`]);
  return USERS.filter((u) => u.role === role).map((u) => [u.id, u.name]);
}

function renderMemberBadges() {
  const box = $('#m_badges');
  if (!box) return;
  box.innerHTML = memberState.map((uid, idx) => {
    const isLeader = idx === 0;
    return `<span class="m-badge ${isLeader ? 'leader' : ''}">
      ${isLeader ? icon('crown', 'i-sm') : ''}${uname(uid)}${isLeader ? ' (负责人)' : ''}
      ${!isLeader ? `<span class="edit-link" onclick="promoteLeader('${uid}')">设负责人</span>` : ''}
      <span class="del" onclick="removeMember('${uid}')">${icon('x', 'i-sm')}</span>
    </span>`;
  }).join('') || '<span class="faint">未添加成员</span>';
}

function promoteLeader(uid) {
  memberState = [uid, ...memberState.filter((u) => u !== uid)];
  renderMemberBadges();
}
function removeMember(uid) {
  memberState = memberState.filter((u) => u !== uid);
  renderMemberBadges();
}
function addMember(uid) {
  if (!memberState.includes(uid)) memberState.push(uid);
  $('#m_search').value = '';
  $('#m_search_res').classList.add('hidden');
  renderMemberBadges();
}
function searchMemberInput(q) {
  const resBox = $('#m_search_res');
  if (!q.trim()) { resBox.classList.add('hidden'); return; }
  const matches = searchUsers(q).filter((u) => !memberState.includes(u.id));
  if (!matches.length) {
    resBox.innerHTML = '<span class="faint">未找到匹配人员</span>';
  } else {
    resBox.innerHTML = matches.map((u) =>
      `<span class="chip" onclick="addMember('${u.id}')">${u.name} <small class="faint">${u.role}</small></span>`
    ).join('');
  }
  resBox.classList.remove('hidden');
}

function memberFieldHtml(initMembers) {
  memberState = initMembers && initMembers.length ? [...initMembers] : [me];
  return `
    <label class="f">项目组成员 <span class="faint">(首位为负责人)</span></label>
    <div class="member-list" id="m_badges"></div>
    <div class="search-box">
      <input type="text" id="m_search" placeholder="输入拼音首字母找人，如 sg 找孙工..." oninput="searchMemberInput(this.value)">
      <div id="m_search_res" class="search-res hidden"></div>
    </div>`;
}

function visibleFieldHtml(vis = []) {
  return VIS_ROLES.slice().reverse().map((r) => {
    const key = ROLE_KEYS[r] || r;
    return `<label class="f sub">${r}</label>${chips('n_v_' + key, peopleOf(r), vis)}`;
  }).join('');
}

// ===== 启动初始化 =====
$('#userSwitch').innerHTML = USERS.map((u) => `<option value="${u.id}" ${u.id === me ? 'selected' : ''}>${u.name} (${u.role})</option>`).join('');
$('#userSwitch').onchange = (e) => {
  me = e.target.value;
  localStorage.setItem(KEY + '-me', me);
  render();
};
$$('#tabbar button[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
render();
