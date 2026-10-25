// ===== 页面视图（精美、少字、点选为主、服务型）=====

let memberState = [];
let pickedClauseState = ''; // 当前选中的条款代码，如 '第十二条第(二)款'
let clausePickerOpen = false;

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

function statusTag(it) {
  if (it.status === 'done') return '<span class="tag green">已审</span>';
  if (it.status === 'accepted') return `<span class="tag blue">已接收${it.appointment ? ' · 约' + fmtAppt(it.appointment) : ''}</span>`;
  return '<span class="tag orange">待审</span>';
}

function catTag(cat) {
  const cls = cat === '正向优化' ? 'green' : cat === '技术修正' ? 'blue' : cat === '控规优化调整' ? 'purple' : cat === '控规修改' ? 'orange' : '';
  return `<span class="tag ${cls}">${esc(cat)}</span>`;
}

// ===== 待办主页（规划师一线视角：极简、只看待审和我参与的项目）=====
function viewTodo() {
  let h = '';

  // 1. 待我审查
  const tasks = myReviewTasks();
  h += `<h2>待我审查 (${tasks.length})</h2>`;
  h += tasks.length ? tasks.map(({ p, r, it }) => `
    <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        ${statusTag(it)}
      </div>
      <div class="muted" style="margin-top:3px">${p.dept || '规划一所'} · ${stageMeta(p, r.stage).name} · ${uname(p.leader)} 送审</div>
      ${r.parallel ? `<div class="tag red" style="margin-top:4px">加急：${esc(r.reason)}</div>` : ''}
    </div>`).join('') : '<div class="card empty" style="padding:14px 0">暂无待审事项 ☕</div>';

  // 2. 我参与的项目
  const mine = DB.projects.filter((p) => p.members.includes(me) && !finished(p));
  h += `<h2>我参与的项目 (${mine.length})</h2>`;
  h += mine.length ? mine.map((p) => {
    const curK = curStage(p);
    const sCur = p.stages[curK] || {};
    const curName = curK ? stageMeta(p, curK).name : '已结项';

    let meetingBadge = '';
    if (sCur.apply) {
      if (sCur.apply.status === 'scheduled') {
        meetingBadge = `<span class="tag green">🗓 开会：${fmtAppt(sCur.apply.scheduledTime)}</span>`;
      } else {
        meetingBadge = `<span class="tag purple">已报会</span>`;
      }
    }

    return `<div class="card click" onclick="go('project','${p.id}')">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        ${catTag(p.category)}
      </div>
      <div class="muted" style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span>当前：<b>${curName}</b></span>
        ${meetingBadge}
      </div>
    </div>`;
  }).join('') : '<div class="card empty" style="padding:14px 0">暂无进行中的项目</div>';

  return h;
}

// ===== 项目列表 =====
function viewProjects() {
  const list = DB.projects.filter((p) => canSee(p, me));
  return `<h2>全部项目 (${list.length})</h2>` + (list.length ? list.map((p) => `
    <div class="card click" onclick="go('project','${p.id}')">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        ${catTag(p.category)}
      </div>
      <div class="muted" style="margin-top:3px">${esc(p.name)}</div>
      <div class="muted" style="margin-top:4px">负责人 ${uname(p.leader)} · ${finished(p) ? '✅ 已结项' : '当前：' + (curStage(p) ? stageMeta(p, curStage(p)).name : '—')}</div>
    </div>`).join('') : '<div class="empty">暂无项目</div>') +
    `<button class="btn gray block" onclick="resetDemo()" style="margin-top:16px">重置示例数据</button>`;
}

// ===== 修改依据选择器（选时看条款内容，选完只显第几条第几款）=====
function clausePickerHtml(cat, curVal = '') {
  const items = CLAUSE_ITEMS[cat];
  if (!items || !items.length) return '';

  const picked = curVal || pickedClauseState || items[0][0];
  pickedClauseState = picked;

  return `
    <label class="f">修改依据</label>
    <div id="clause_container">
      <div class="clause-picked-bar">
        <span class="tag blue" style="font-size:13px;padding:3px 10px;font-weight:600">📜 ${esc(picked)}</span>
        <button type="button" class="btn sm ghost" onclick="toggleClausePicker('${esc(cat)}')">${clausePickerOpen ? '收起' : '更换依据'}</button>
      </div>
      <input type="hidden" id="c_clause_val" value="${esc(picked)}">
      <div class="clause-list" id="clause_list" style="display:${clausePickerOpen ? 'flex' : 'none'}">
        ${items.map(([code, desc]) => `
          <div class="clause-opt ${code === picked ? 'on' : ''}" onclick="selectClause('${esc(code)}','${esc(cat)}')">
            <b>${esc(code)}</b>
            <span>${esc(desc)}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function toggleClausePicker(cat) {
  clausePickerOpen = !clausePickerOpen;
  const list = $('#clause_list');
  if (list) list.style.display = clausePickerOpen ? 'flex' : 'none';
  const btn = $('#clause_container button');
  if (btn) btn.textContent = clausePickerOpen ? '收起' : '更换依据';
}

function selectClause(code, cat) {
  pickedClauseState = code;
  clausePickerOpen = false;
  const c = $('#clause_container');
  if (c) c.outerHTML = clausePickerHtml(cat, code).replace('<label class="f">修改依据</label>', '');
}

// 方案内容表单：只传用地图 + 指标表（双栏紧凑），内容不多、会上说
function contentFields(cat, v = {}) {
  if (cat === '其他（待开发）') {
    return `<div class="empty" style="padding:16px 0">专项规划等其他类型正在开发中...</div>`;
  }
  const imgsA = (v.imgs && v.imgs.a) || [];
  const imgsB = (v.imgs && v.imgs.b) || [];
  const curClause = v.clause || '';

  return `
    ${clausePickerHtml(cat, curClause)}
    <div class="upl-grid">
      ${uploader('c_a', imgsA, '用地图')}
      ${uploader('c_b', imgsB, '指标表')}
    </div>`;
}

function readContent() {
  return {
    clause: $('#c_clause_val')?.value || pickedClauseState || '',
    imgs: {
      a: [...(UPL.c_a || [])],
      b: [...(UPL.c_b || [])],
    },
  };
}

// ===== 新建项目视图（精美、字少、快捷选人）=====
function viewNew() {
  return `<h2>新建项目</h2>
  <div class="card">
    <label class="f" style="margin-top:0">项目类别</label>
    ${chips('n_cat', CATEGORIES.map((c) => [c, c]), ['控规优化调整'], true)}
    <div id="n_catTip" class="muted" style="margin-top:4px;font-size:12px;color:#1d5eff"></div>

    <label class="f">项目正式名称</label>
    <input type="text" id="n_name" placeholder="输入名称或粘贴截图">
    <div style="margin-top:4px">${uploader('n_nameImg')}</div>

    <label class="f">俗称（简称）</label>
    <input type="text" id="n_alias" placeholder="如：东湖地块 / 滨江商务区">

    <div id="n_pubBox" style="display:none">
      <label class="f">公示节点（控规修改）</label>
      ${chips('n_pub', [['after', '联审会后'], ['before', '联审会前']], ['after'], true)}
    </div>
  </div>

  <div id="n_rest">
    <div class="card">
      ${memberFieldHtml([me])}
      <label class="f" style="margin-top:14px">公开给谁看</label>
      ${visibleFieldHtml()}
    </div>

    <h2>方案图件与依据</h2>
    <div class="card" id="n_content"></div>

    <button class="btn block" onclick="doCreate()" style="font-size:15px;padding:11px">创建项目</button>
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
    clausePickerOpen = false;
    pickedClauseState = '';
    $('#n_catTip').textContent = tips[cat] || '';
    $('#n_pubBox').style.display = cat === '控规修改' ? '' : 'none';
    $('#n_content').innerHTML = contentFields(cat);
    $('#n_rest').style.display = isOther ? 'none' : '';
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
  const visible = VIS_ROLES.flatMap((r) => picked('#n_v_' + r));
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

// ===== 方案内容卡片（极简：只显示条文代码 + 用地图 + 指标表）=====
function renderSchemeCard(p) {
  const vs = p.versions;
  const isMulti = vs.length > 1;
  const cur = vs[vs.length - 1];

  const bodyHtml = (v, isOld) => {
    const imgs = v.imgs || {};
    return `
      <div class="ver ${!isMulti ? 'single' : isOld ? 'old' : ''}">
        ${isMulti ? `<div class="row"><b>第 ${v.no} 版</b><span class="muted">${v.at} · ${uname(v.by)}</span></div>` : ''}
        ${isMulti && v.note ? `<div class="note">${esc(v.note)}</div>` : ''}
        ${v.clause ? `<div style="margin:4px 0"><span class="tag blue">📜 ${esc(v.clause)}</span></div>` : ''}
        <div class="scheme-pair">
          <div class="scheme-box">
            <div class="lbl">用地图</div>
            ${imgsHtml(imgs.a) || '<span class="muted">—</span>'}
          </div>
          <div class="scheme-box">
            <div class="lbl">指标表</div>
            ${imgsHtml(imgs.b) || '<span class="muted">—</span>'}
          </div>
        </div>
      </div>`;
  };

  return `<div class="card">
    ${bodyHtml(cur, false)}
    ${isMulti ? `<details><summary>历史方案 (${vs.length - 1} 个早期版本)</summary>${vs.slice(0, -1).reverse().map((v) => bodyHtml(v, true)).join('')}</details>` : ''}
  </div>`;
}

// ===== 项目详情页（精简、去AI腔调、报会不阻塞、少打字）=====
function viewProject(p) {
  if (!p) return '<div class="empty">项目不存在</div>';
  if (!canSee(p, me)) return '<div class="empty">🔒 你不在该项目的公开范围内</div>';
  const keys = path(p), cur = curStage(p), def = stageMeta(p, cur), team = isTeam(p);
  const sCur = p.stages[cur] || {};
  const isApplied = !!sCur.apply;
  const isScheduled = isApplied && sCur.apply.status === 'scheduled';

  // 当前阶段动作卡片（无AI用语，直接呈现动作按钮）
  let stageCard = '';
  if (team) {
    const revertBtn = p.stageIdx > 0 ? `<button class="btn sm gray" onclick="revertStage(P('${p.id}'))">↩ 退回上一步</button>` : '';

    if (finished(p)) {
      stageCard = `<div class="card" style="border:1.5px solid #16a34a;background:#f7fcf9">
        <div class="row">
          <b style="color:#15803d;font-size:15px">🎉 全部审查及入库流程已结项</b>
          <span class="tag green">已办结</span>
        </div>
        <div style="margin-top:10px">${revertBtn}</div>
      </div>`;
    } else if (cur === 's2' || def.name.includes('技术审查会')) {
      // 分院技术审查会：一键报会、绝不阻塞，随时可推进评审审查
      stageCard = `<div class="card" style="border:1.5px solid #d8b4fe;background:#fcfaff">
        <div class="row">
          <b style="font-size:15px;color:#6b21a8">${esc(def.name)}</b>
          ${isScheduled ? '<span class="tag green">已排期</span>' : isApplied ? '<span class="tag purple">已报会</span>' : '<span class="tag gray">未报会</span>'}
        </div>

        ${isScheduled ? `
          <div style="margin-top:6px;font-size:13px;color:#15803d;background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #bbf7d0">
            🗓 <b>已排期：</b>${fmtAppt(sCur.apply.scheduledTime)} · ${esc(sCur.apply.location || '三楼大会议室')}
          </div>` : ''}

        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          ${!isApplied ? `
            <button class="btn purple block" style="margin-top:0" onclick="oneTapApplyMeeting('${p.id}','${cur}')">📅 一键报会（报给院长凑会）</button>
            <button class="btn ghost block" style="margin-top:0" onclick="completeStage(P('${p.id}'), true)">不上会，直接进入评审审查 →</button>
          ` : `
            <button class="btn green block" style="margin-top:0;font-size:15px" onclick="completeStage(P('${p.id}'))">进入评审审查（不等开会直接推）→</button>
            <div class="row" style="margin-top:2px">
              <button class="btn sm ghost purple" onclick="meetingModal('${p.id}','${cur}')">📝 记会议结果</button>
              <span class="edit-link" onclick="cancelApplyMeeting('${p.id}','${cur}')" style="color:#94a3b8">取消报会</span>
            </div>
          `}
        </div>

        <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
          <button class="btn sm ghost" onclick="versionModal('${p.id}')">＋ 传新版方案</button>
          <div>${revertBtn}</div>
        </div>
      </div>`;
    } else if (def.type === 'meeting') {
      // 其他会议阶段（联审会、局长办公会、市政府会）
      stageCard = `<div class="card" style="border:1.5px solid #93c5fd;background:#f8fbff">
        <div class="row">
          <b style="font-size:15px;color:#1d4ed8">${esc(def.name)}</b>
          <span class="tag blue">会议节点</span>
        </div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          ${def.preReview ? `<button class="btn ghost block" style="margin-top:0" onclick="reviewModal('${p.id}')">📤 发起会前预审</button>` : ''}
          <button class="btn block" style="margin-top:0" onclick="meetingModal('${p.id}','${cur}')">📝 记录会议信息</button>
          <button class="btn green block" style="margin-top:0" onclick="completeStage(P('${p.id}'))">完成本阶段，进入下一步 →</button>
        </div>
        <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
          <button class="btn sm ghost" onclick="versionModal('${p.id}')">＋ 传新版方案</button>
          <div>${revertBtn}</div>
        </div>
      </div>`;
    } else {
      // 审查节点
      const stageReviews = p.reviews.filter((r) => r.stage === cur);
      let reviewAction = '';

      if (!stageReviews.length) {
        reviewAction = `
          <button class="btn block" style="margin-top:0;font-size:15px" onclick="reviewModal('${p.id}')">📤 送审「${def.forms ? def.forms[0] : '成果'}」</button>
          ${def.optional ? `<button class="btn ghost sm block" style="margin-top:6px" onclick="completeStage(P('${p.id}'), true)">${esc(def.skipLabel || '跳过此阶段 →')}</button>` : ''}`;
      } else {
        const allDone = stageReviews.every((r) => r.items.every((it) => it.status === 'done'));
        const pendingItems = stageReviews.flatMap((r) => r.items.filter((it) => it.status !== 'done'));

        if (allDone) {
          reviewAction = `
            <div style="color:#15803d;font-weight:600;font-size:13px;margin-bottom:6px">✔ 审查意见已全部反馈完成</div>
            <button class="btn green block" style="margin-top:0" onclick="completeStage(P('${p.id}'))">进入下一阶段 →</button>
            <button class="btn ghost sm" style="margin-top:6px" onclick="reviewModal('${p.id}')">＋ 追加送审其他人</button>`;
        } else {
          reviewAction = `
            <div class="muted" style="font-size:13px;margin-bottom:8px">正在等待：<b>${pendingItems.map((i) => uname(i.uid)).join('、')}</b> 审查反馈</div>
            <div class="row">
              <button class="btn sm ghost" onclick="reviewModal('${p.id}')">＋ 追加送审</button>
              <button class="btn sm green" onclick="completeStage(P('${p.id}'))">直接进入下一阶段 →</button>
            </div>`;
        }
      }

      stageCard = `<div class="card" style="border:1.5px solid #93c5fd;background:#f8fbff">
        <div class="row">
          <b style="font-size:15px;color:#1d4ed8">${esc(def.name)}</b>
          <span class="tag blue">审查节点</span>
        </div>
        <div style="margin-top:10px">${reviewAction}</div>
        <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
          <button class="btn sm ghost" onclick="versionModal('${p.id}')">＋ 传新版方案</button>
          <div>${revertBtn}</div>
        </div>
      </div>`;
    }
  }

  const otherMembers = p.members.filter((m) => m !== p.leader);

  return `<div class="card">
    <div class="row">
      <b style="font-size:16px">${esc(p.alias || p.name)}</b>
      <div>
        <span class="tag purple">${p.dept || '规划一所'}</span>
        ${catTag(p.category)}
      </div>
    </div>
    ${p.alias && p.alias !== p.name ? `<div class="muted" style="margin-top:2px">${esc(p.name)}</div>` : ''}
    ${imgsHtml(p.nameImgs)}
    <div class="muted" style="margin-top:4px">
      负责人：<b>${uname(p.leader)}</b>${otherMembers.length ? ' · 成员：' + otherMembers.map(uname).join('、') : ''}
    </div>
    <div class="muted" style="margin-top:2px">公开：${p.visible.map(uname).join('、')}</div>
    ${team ? `<div style="text-align:right;margin-top:6px"><span class="edit-link" onclick="editProjectModal('${p.id}')">修改信息</span></div>` : ''}
  </div>

  ${stageCard}

  <h2>方案图件与依据</h2>
  ${renderSchemeCard(p)}

  <h2>流程进度</h2>
  <div class="card">
    <ul class="timeline">
      ${keys.map((k, i) => {
        const s = p.stages[k] || {};
        const m = stageMeta(p, k);
        const cls = s.skipped ? 'skip' : i < p.stageIdx ? 'done' : i === p.stageIdx ? 'cur' : '';
        return `<li class="${cls}">
          <span class="sname">${esc(m.name)}</span>
          ${m.optional ? '<span class="tag">可选</span>' : ''}
          ${stageDetail(p, k)}
        </li>`;
      }).join('')}
    </ul>
    <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #e2e8f0;text-align:center">
      <span class="edit-link" onclick="historyModal('${p.id}')">📜 查看完整操作记录 (${p.log.length})</span>
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
        <span><b>分院审查会报会</b></span>
        <span class="tag ${ap.status === 'scheduled' ? 'green' : 'purple'}">${ap.status === 'scheduled' ? '已排期' : '已报会'}</span>
      </div>
      <div class="muted" style="margin-top:2px">报会人：${uname(ap.applicant || p.leader)} · ${ap.submittedAt || ''}</div>
      ${ap.scheduledTime ? `<div style="margin-top:4px;color:#15803d;font-weight:600">🗓 开会：${fmtAppt(ap.scheduledTime)} · ${esc(ap.location || '三楼大会议室')}</div>` : ''}
      ${U(me).role === '院长' && ap.status === 'pending' ? `<div style="text-align:right;margin-top:4px"><button class="btn sm purple" onclick="deanScheduleModal('${p.id}','${key}')">排定会议</button></div>` : ''}
    </div>`;
  }

  if (s.meeting) {
    const m = s.meeting;
    h += `<div class="opinion meeting">
      <div class="row">
        <span>🗓 <b>${fmtAppt(m.time) || '已开会'}</b> · ${esc(m.opinion || '原则通过')}</span>
        ${isTeam(p) ? `<span class="edit-link" onclick="meetingModal('${p.id}','${key}')">修改</span>` : ''}
      </div>
      ${m.location ? `<div class="muted" style="margin-top:2px">地点：${esc(m.location)}</div>` : ''}
      ${m.implement ? `<div style="margin-top:2px;font-size:12.5px">${esc(m.implement)}</div>` : ''}
      <div>${imgsHtml(m.photos)}</div>
    </div>`;
  }

  p.reviews.filter((r) => r.stage === key).forEach((r) => {
    r.items.forEach((it) => {
      const mineDone = it.uid === me && it.status === 'done';
      h += `<div class="stage-item">
        <div class="row">
          <span><b>${uname(it.uid)}</b> <small class="muted">(${U(it.uid).role})</small></span>
          ${statusTag(it)}
        </div>
        ${fbSummary(it.feedback)}
        ${mineDone ? `<div style="text-align:right;margin-top:2px"><span class="edit-link" onclick="feedbackModal('${p.id}','${r.id}')">修改意见</span></div>` : ''}
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
    <div class="card" style="border:1.5px solid #8250df;background:linear-gradient(135deg, #faf7ff 0%, #f3ebff 100%)">
      <div class="row">
        <b style="font-size:16px;color:#581c87">👑 王院长看板</b>
        <span class="tag purple">全院 ${total} 项</span>
      </div>
    </div>

    <h2>待办事项</h2>
    <div class="card click" style="border-color:#d8b4fe" onclick="go('dean-meetings')">
      <div class="row">
        <b>⚡ 分院技术审查会报会</b>
        <span class="tag ${applies.length ? 'purple' : 'gray'}">${applies.length} 项待排期</span>
      </div>
      <div class="muted" style="margin-top:4px">${applies.length ? applies.map(({ p }) => esc(p.alias || p.name)).join('、') : '暂无待排期报会'}</div>
    </div>

    <div class="card click" style="border-color:#d8b4fe" onclick="go('dean-notes')">
      <div class="row">
        <b>✉️ 院长直通车留言</b>
        <span class="tag ${notes.length ? 'purple' : 'gray'}">${notes.length} 条待回复</span>
      </div>
      <div class="muted" style="margin-top:4px">${notes.length ? notes.map(({ p, note }) => `${esc(p.alias || p.name)} (${esc(note.topic || '请示')})`).join('、') : '暂无待回复留言'}</div>
    </div>
  `;
}

function viewDeanMeetings() {
  const applies = deanPendingApplies();
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm gray" onclick="go('todo')">← 返回看板</button>
      <span class="muted" style="font-size:12.5px">分院技术审查会排期</span>
    </div>

    ${applies.length >= 2 ? `
      <div class="card" style="background:#fffbeb;border:1px solid #fde68a">
        <div class="row">
          <b style="color:#b45309">已达集中开会建议量 (${applies.length} 项)</b>
          <button class="btn sm purple" onclick="deanBatchScheduleModal()">一键合并排期</button>
        </div>
      </div>` : ''}

    ${!applies.length ? '<div class="empty">暂无待开会的报会申请</div>' : applies.map(({ p, key, apply }) => `
      <div class="card">
        <div class="row">
          <b>${esc(p.alias || p.name)}</b>
          <span class="tag purple">${p.dept || '规划一所'}</span>
        </div>
        <div class="muted" style="margin-top:3px">报会人：${uname(apply.applicant || p.leader)} · ${apply.submittedAt || ''}</div>
        <div class="row" style="margin-top:8px">
          <span class="edit-link" onclick="go('project','${p.id}')" style="margin-left:0">查看项目 →</span>
          <button class="btn sm purple" onclick="deanScheduleModal('${p.id}','${key}')">排定时间</button>
        </div>
      </div>`).join('')}
  `;
}

function viewDeanNotes() {
  const notes = deanPendingNotes();
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm gray" onclick="go('todo')">← 返回看板</button>
      <span class="muted" style="font-size:12.5px">院长直通车留言</span>
    </div>

    ${!notes.length ? '<div class="empty">暂无待回复直通车留言</div>' : notes.map(({ p, note }) => `
      <div class="card">
        <div class="row">
          <b>${esc(p.alias || p.name)} · ${esc(note.topic || '请示')}</b>
          ${note.urgent ? '<span class="tag red">加急</span>' : ''}
        </div>
        <div class="muted" style="margin-top:2px">来自：${uname(note.by)} · ${note.at}</div>
        ${note.text ? `<div style="margin-top:6px;font-size:13px;background:#f8fafc;padding:6px 8px;border-radius:6px">${esc(note.text)}</div>` : ''}
        <div style="text-align:right;margin-top:8px">
          <button class="btn sm purple" onclick="deanReplyNoteModal('${p.id}','${note.id}')">回复预约时间</button>
        </div>
      </div>`).join('')}
  `;
}

// ===== 李院总看板 =====
function viewChiefEngineerBoard() {
  const myTasks = myReviewTasks();
  const issues = DB.commonIssues || [];

  return `
    <div class="card" style="border:1.5px solid #1d5eff;background:linear-gradient(135deg, #f0f6ff 0%, #e6f0fd 100%)">
      <div class="row">
        <b style="font-size:16px;color:#1e40af">🏛 李院总看板</b>
        <span class="tag blue">把关大盘</span>
      </div>
    </div>

    <h2>待办事项</h2>
    <div class="card click" onclick="go('ce-reviews')">
      <div class="row">
        <b>待我技术把关审查</b>
        <span class="tag ${myTasks.length ? 'red' : 'gray'}">${myTasks.length} 项</span>
      </div>
    </div>

    <div class="card click" onclick="go('ce-issues')">
      <div class="row">
        <b>共性技术问题收集板</b>
        <span class="tag purple">${issues.length} 条</span>
      </div>
    </div>
  `;
}

function viewChiefEngineerReviews() {
  const tasks = myReviewTasks();
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm gray" onclick="go('todo')">← 返回院总看板</button>
      <span class="muted" style="font-size:12.5px">待审成果</span>
    </div>
    ${!tasks.length ? '<div class="empty">暂无待审成果 ☕</div>' : tasks.map(({ p, r, it }) => `
      <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
        <div class="row">
          <b>${esc(p.alias || p.name)}</b>
          ${statusTag(it)}
        </div>
        <div class="muted" style="margin-top:2px">${p.dept || '规划一所'} · ${stageMeta(p, r.stage).name} · ${uname(p.leader)} 送审</div>
        ${r.parallel ? `<span class="tag red" style="margin-top:4px">加急：${esc(r.reason)}</span>` : ''}
      </div>`).join('')}
  `;
}

function viewChiefEngineerUpcoming() { return viewChiefEngineerReviews(); }

function viewChiefEngineerIssues() {
  const issues = DB.commonIssues || [];
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm gray" onclick="go('todo')">← 返回院总看板</button>
      <button class="btn sm purple" onclick="newIssueModal()">＋ 新增注意点</button>
    </div>
    ${!issues.length ? '<div class="empty">暂无共性问题</div>' : issues.map((iss) => `
      <div class="issue-card">
        <div class="row">
          <b>${esc(iss.title)}</b>
          <span class="tag blue">${esc(iss.category)}</span>
        </div>
        <div class="muted" style="margin-top:4px">${esc(iss.guide || iss.problem)}</div>
        <div class="row" style="margin-top:8px">
          <button class="btn sm gray" onclick="editIssueModal('${iss.id}')">修改</button>
          <button class="btn sm purple" onclick="broadcastIssueModal('${iss.id}')">发布至「新规」提醒</button>
        </div>
      </div>`).join('')}
  `;
}

// ===== 所长看板 =====
function viewDirectorBoard() {
  const dept = U(me).dept || '规划一所';
  const dProjects = deptProjects(dept);
  const myReviews = myReviewTasks();
  const applies = deptMeetingApplies(dept);

  return `
    <div class="card" style="border:1.5px solid #1d5eff;background:#f8fbff">
      <div class="row">
        <b style="font-size:16px;color:#1e40af">🏢 ${dept} 看板</b>
        <span class="tag blue">${dProjects.length} 项在编</span>
      </div>
    </div>

    ${myReviews.length ? `
      <h2>待我把关 (${myReviews.length})</h2>
      ${myReviews.map(({ p, r, it }) => `
        <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
          <div class="row"><b>${esc(p.alias || p.name)}</b>${statusTag(it)}</div>
          <div class="muted" style="margin-top:2px">${stageMeta(p, r.stage).name} · ${uname(p.leader)} 送审</div>
        </div>`).join('')}` : ''}

    ${applies.length ? `
      <h2>本所报会追踪 (${applies.length})</h2>
      ${applies.map(({ p, apply }) => `
        <div class="card click" onclick="go('project','${p.id}')">
          <div class="row">
            <b>${esc(p.alias || p.name)}</b>
            <span class="tag ${apply.status === 'scheduled' ? 'green' : 'purple'}">${apply.status === 'scheduled' ? '已排期' : '已报会'}</span>
          </div>
          ${apply.scheduledTime ? `<div class="muted" style="margin-top:3px;color:#15803d">开会：${fmtAppt(apply.scheduledTime)} · ${esc(apply.location || '三楼大会议室')}</div>` : ''}
        </div>`).join('')}` : ''}

    <h2>本所项目清单</h2>
    ${dProjects.map((p) => `
      <div class="card click" onclick="go('project','${p.id}')">
        <div class="row">
          <b>${esc(p.alias || p.name)}</b>
          ${catTag(p.category)}
        </div>
        <div class="muted" style="margin-top:2px">${esc(p.name)}</div>
        <div class="muted" style="margin-top:3px">负责人：${uname(p.leader)} · ${finished(p) ? '✅ 已结项' : '当前：' + stageMeta(p, curStage(p)).name}</div>
      </div>`).join('')}
  `;
}

// ===== 成员管理组件 =====
function peopleOf(role) { return USERS.filter((u) => u.role === role).map((u) => [u.id, u.name]); }

function renderMemberBadges() {
  const box = $('#m_badges');
  if (!box) return;
  box.innerHTML = memberState.map((uid, idx) => {
    const isLeader = idx === 0;
    return `<span class="m-badge ${isLeader ? 'leader' : ''}">
      ${isLeader ? '👑 ' : ''}${uname(uid)}${isLeader ? ' (负责人)' : ''}
      ${!isLeader ? `<span class="edit-link" onclick="promoteLeader('${uid}')" style="font-size:11px">设负责人</span>` : ''}
      <span class="del" onclick="removeMember('${uid}')">×</span>
    </span>`;
  }).join('') || '<span class="muted">未添加成员</span>';
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
  $('#m_search_res').style.display = 'none';
  renderMemberBadges();
}
function searchMemberInput(q) {
  const resBox = $('#m_search_res');
  if (!q.trim()) { resBox.style.display = 'none'; return; }
  const matches = searchUsers(q).filter((u) => !memberState.includes(u.id));
  if (!matches.length) {
    resBox.innerHTML = '<span class="muted" style="font-size:12px">未找到匹配人员</span>';
  } else {
    resBox.innerHTML = matches.map((u) =>
      `<span class="chip" onclick="addMember('${u.id}')">${u.name} <small class="muted">${u.role}</small></span>`
    ).join('');
  }
  resBox.style.display = 'block';
}

function memberFieldHtml(initMembers) {
  memberState = initMembers && initMembers.length ? [...initMembers] : [me];
  return `
    <label class="f" style="margin-top:0">项目组成员 <span class="muted" style="font-weight:normal">(首位为负责人)</span></label>
    <div class="member-list" id="m_badges"></div>
    <div class="search-box">
      <input type="text" id="m_search" placeholder="输入拼音首字母找人，如 sg 找孙工..." oninput="searchMemberInput(this.value)">
      <div id="m_search_res" class="search-res" style="display:none"></div>
    </div>`;
}

function visibleFieldHtml(vis = []) {
  return VIS_ROLES.slice().reverse().map((r) =>
    `<label class="f">${r}</label>${chips('n_v_' + r, peopleOf(r), vis)}`
  ).join('');
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
