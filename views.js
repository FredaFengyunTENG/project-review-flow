// ===== 页面视图 =====

let memberState = []; // 当前编辑中的项目组成员列表 [uid1, uid2...] 第一位为负责人

function render() {
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === route.name));
  const v = $('#view');
  lastUpl = null;
  if (route.name === 'todo') v.innerHTML = viewTodo();
  else if (route.name === 'projects') v.innerHTML = viewProjects();
  else if (route.name === 'new') { v.innerHTML = viewNew(); bindNew(); }
  else if (route.name === 'project') v.innerHTML = viewProject(P(route.arg));
}

function statusTag(it) {
  if (it.status === 'done') return '<span class="tag green">已反馈</span>';
  if (it.status === 'accepted') return `<span class="tag blue">已接收${it.appointment ? ' · 约 ' + fmtAppt(it.appointment) : ''}</span>`;
  return '<span class="tag orange">待接收</span>';
}

function viewTodo() {
  let h = '';

  // 1. 如果当前身份是院长（王院长），优先显示「待我排期 / 报会申请」
  if (U(me).role === '院长') {
    const applies = deanPendingApplies();
    h += `<h2>🔔 待我排期 / 报会申请（${applies.length}）</h2>`;
    h += applies.length ? applies.map(({ p, key, apply }) => `
      <div class="card click" style="border:1.5px solid #8250df;background:#faf8ff" onclick="deanScheduleModal('${p.id}','${key}')">
        <div class="row">
          <b>${esc(p.alias || p.name)}</b>
          <span class="tag purple">${STAGES[key].name}</span>
        </div>
        <div class="muted" style="margin-top:4px">
          ${uname(apply.applicant || p.leader)} 申请直报王院长排期
        </div>
        <div style="margin-top:4px;font-size:13px;color:#8250df">
          <b>期望时间：</b>${esc(apply.prefQuick || fmtAppt(apply.prefTime) || '尽快安排')}
        </div>
        ${apply.note ? `<div class="muted" style="margin-top:2px;font-size:12px;color:#475569">说明：${esc(apply.note)}</div>` : ''}
        <div style="margin-top:8px;color:#8250df;font-size:13px;font-weight:600">👉 点此审批并排定会议</div>
      </div>`).join('') : '<div class="empty">暂无待排期报会申请 ☕</div>';
  }

  // 2. 待我审查
  const tasks = myReviewTasks();
  h += `<h2>待我审查（${tasks.length}）</h2>`;
  h += tasks.length ? tasks.map(({ p, r, it }) => `
    <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row"><b>${esc(p.alias || p.name)}</b>${statusTag(it)}</div>
      <div class="muted" style="margin-top:4px">${STAGES[r.stage].name} · ${uname(p.leader)} 送审</div>
      ${r.parallel ? `<span class="tag red">同时审查：${esc(r.reason)}</span>` : ''}
      <div style="margin-top:8px;color:#1f6feb;font-size:13px;font-weight:500">${it.status === 'pending' ? '👉 点此接收' + (r.paper ? '并约送册时间' : '') : '👉 点此填写审查意见'}</div>
    </div>`).join('') : '<div class="empty">暂无待审查事项 ☕</div>';

  // 3. 我参与的项目
  const mine = DB.projects.filter((p) => p.members.includes(me) && !finished(p));
  h += `<h2>我参与的项目（${mine.length}）</h2>`;
  h += mine.length ? mine.map((p) => {
    const curK = curStage(p);
    const sCur = p.stages[curK] || {};
    const items = p.reviews.filter((r) => r.stage === curK).flatMap((r) => r.items);
    const appts = items.filter((i) => i.status === 'accepted' && i.appointment);
    const back = items.filter((i) => i.status === 'done');
    const curName = STAGES[curK] ? STAGES[curK].name : '已完成';

    let applyBadge = '';
    if (sCur.apply) {
      if (sCur.apply.status === 'pending') {
        applyBadge = `<div class="tag purple">⏳ 已直报院长，待排期中</div>`;
      } else if (sCur.apply.status === 'scheduled') {
        applyBadge = `<div class="tag green">🗓 院长已排期：${fmtAppt(sCur.apply.scheduledTime)}（${esc(sCur.apply.location || '三楼大会议室')}）</div>`;
      }
    }

    return `<div class="card click" onclick="go('project','${p.id}')">
      <div class="row"><b>${esc(p.alias || p.name)}</b><span class="tag">${p.category}</span></div>
      <div class="muted" style="margin-top:4px">当前阶段：${curName}</div>
      ${applyBadge}
      ${appts.map((i) => `<div class="tag blue">📅 ${uname(i.uid)} 约 ${fmtAppt(i.appointment)} 送册</div>`).join('')}
      ${back.length ? `<div class="tag green">💬 本阶段已收到 ${back.length} 份意见</div>` : ''}
    </div>`;
  }).join('') : '<div class="empty">暂无</div>';
  return h;
}

function viewProjects() {
  const list = DB.projects.filter((p) => canSee(p, me));
  return `<h2>我能看到的项目（${list.length}）</h2>` + (list.length ? list.map((p) => `
    <div class="card click" onclick="go('project','${p.id}')">
      <div class="row"><b>${esc(p.alias || p.name)}</b><span class="tag">${p.category}</span></div>
      <div class="muted" style="margin-top:2px">${esc(p.name)}</div>
      <div class="muted" style="margin-top:4px">负责人 ${uname(p.leader)} · ${finished(p) ? '✅ 已完成' : '当前：' + (STAGES[curStage(p)] ? STAGES[curStage(p)].name : '—')}</div>
    </div>`).join('') : '<div class="empty">暂无</div>') +
    `<button class="btn gray block" onclick="resetDemo()">重置示例数据</button>`;
}

function peopleOf(role) { return USERS.filter((u) => u.role === role).map((u) => [u.id, u.name]); }

// ===== 成员管理组件（拼音搜索 + 设第一位为负责人）=====
function renderMemberBadges() {
  const box = $('#m_badges');
  if (!box) return;
  box.innerHTML = memberState.map((uid, idx) => {
    const isLeader = idx === 0;
    return `<span class="m-badge ${isLeader ? 'leader' : ''}">
      ${isLeader ? '👑 ' : ''}${uname(uid)}${isLeader ? ' (负责人)' : ''}
      ${!isLeader ? `<span class="edit-link" onclick="promoteLeader('${uid}')" title="设为负责人" style="font-size:11px">设负责人</span>` : ''}
      <span class="del" onclick="removeMember('${uid}')" title="移除">×</span>
    </span>`;
  }).join('') || '<span class="muted">尚未添加成员</span>';
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
    resBox.innerHTML = '<span class="muted" style="font-size:12px">未找到匹配的职工</span>';
  } else {
    resBox.innerHTML = matches.map((u) =>
      `<span class="chip" onclick="addMember('${u.id}')">${u.name} <small class="muted">${u.role}</small></span>`
    ).join('');
  }
  resBox.style.display = 'block';
}

// 统一成员选择表单
function memberFieldHtml(initMembers) {
  memberState = initMembers && initMembers.length ? [...initMembers] : [me];
  return `
    <label class="f"><b>项目组成员</b> <span class="muted" style="font-weight:normal">（第一位为项目负责人，其余人员排名不分先后）</span></label>
    <div class="member-list" id="m_badges"></div>
    <div class="search-box">
      <input type="text" id="m_search" placeholder="🔍 输入拼音首字母搜索职工，如 sg 找孙工/沈工..." oninput="searchMemberInput(this.value)">
      <div id="m_search_res" class="search-res" style="display:none"></div>
    </div>`;
}

// 公开范围选择
function visibleFieldHtml(vis = []) {
  return VIS_ROLES.slice().reverse().map((r) =>
    `<label class="f">${r}${r === '校对' ? '（选填）' : ''}</label>${chips('n_v_' + r, peopleOf(r), vis)}`
  ).join('');
}

// 方案内容表单
function contentFields(cat, v = {}) {
  if (cat === '其他（待开发）') {
    return `<div class="empty" style="padding:20px 0">🚧 专项规划等其他类型项目流程正在开发中，敬请期待...</div>`;
  }
  if (cat === '控规') return `<label class="f">用地图</label>${uploader('c_a')}
    <label class="f">指标表（地上地下）</label>${uploader('c_b')}`;
  
  const clauses = CLAUSES[cat] || [];
  return `<label class="f">${cat === '控规修改' ? '修改' : '优化调整'}内容（图片为主）</label>${uploader('c_a')}
    <textarea id="c_text" placeholder="文字选填，一句话概括" style="margin-top:6px">${esc(v.text || '')}</textarea>
    <label class="f">法规依据：${BASIS[cat] || ''}（共 ${clauses.length} 种情形）</label>
    ${chips('c_clause', clauses.map((x) => [x, x]), v.clause ? [v.clause] : [], true)}`;
}

function readContent() {
  return { text: $('#c_text')?.value.trim() || '', clause: picked('#c_clause')[0] || '', imgs: { a: [...(UPL.c_a || [])], b: [...(UPL.c_b || [])] } };
}

function viewNew() {
  return `<h2>新建项目</h2><div class="card">
    <label class="f">项目类别</label>
    ${chips('n_cat', CATEGORIES.map((c) => [c, c]), ['控规修改'], true)}
    <div id="n_pubBox"><label class="f">公示时间</label>
      ${chips('n_pub', [['after', '联审会后（常用）'], ['before', '联审会前']], ['after'], true)}</div>
    <div id="n_nameBox">
      <label class="f">正式名称</label>
      <input type="text" id="n_name" data-upl="n_nameImg" placeholder="输入文字，或在下方拍照 / 粘贴截图">
      <div style="margin-top:6px">${uploader('n_nameImg')}</div>
      <label class="f">俗称</label><input type="text" id="n_alias" placeholder="如：东湖地块">
    </div>
  </div>
  <div id="n_rest">
    <h2>项目组成员</h2>
    <div class="card">${memberFieldHtml([me])}</div>
    <h2>对谁公开</h2>
    <div class="card">${visibleFieldHtml()}</div>
    <h2>项目主要内容</h2>
    <div class="card" id="n_content"></div>
    <button class="btn block" onclick="doCreate()">创建项目</button>
    <div class="muted" style="text-align:center;margin-top:8px">创建后不会通知任何人</div>
  </div>`;
}

function bindNew() {
  renderMemberBadges();
  const upd = () => {
    const cat = picked('#n_cat')[0] || '控规修改';
    const isOther = cat === '其他（待开发）';
    $('#n_pubBox').style.display = (cat === '控规' || isOther) ? 'none' : '';
    $('#n_content').innerHTML = contentFields(cat);
    $('#n_nameBox').style.display = isOther ? 'none' : '';
    $('#n_rest').style.display = isOther ? 'none' : '';
    if (isOther) {
      $('#n_pubBox').insertAdjacentHTML('afterend', '<div class="card empty" id="other_tip">🚧 专项规划等其他类型项目流程正在开发中，敬请期待...</div>');
    } else {
      $('#other_tip')?.remove();
    }
  };
  $('#n_cat').addEventListener('change', upd);
  upd();
}

function doCreate() {
  const category = picked('#n_cat')[0];
  if (category === '其他（待开发）') return toast('该类型暂未开放');
  const nameImgs = [...(UPL.n_nameImg || [])];
  const name = $('#n_name').value.trim() || (nameImgs.length ? '（见名称截图）' : '');
  if (!name) return toast('请填写正式名称或粘贴截图');
  if (!memberState.length) return toast('请添加至少一位项目成员');
  const visible = VIS_ROLES.flatMap((r) => picked('#n_v_' + r));
  createProject({
    category, name, nameImgs, alias: $('#n_alias').value.trim(), publicity: picked('#n_pub')[0] || 'after',
    leader: memberState[0], members: memberState, visible, version: readContent(),
  });
}

function fbSummary(f) {
  if (!f) return '';
  if (f.quick) return `<div class="opinion">✅ ${esc(f.quick)}</div>`;
  return `<div class="opinion">
    ${f.dataErr ? `数据错误 <b>${f.dataErr}</b> 处　` : ''}${f.textErr ? `文字错误 <b>${f.textErr}</b> 处` : ''}
    ${f.key ? `<div style="margin-top:2px"><b>重点意见：</b>${esc(f.key)}</div>` : ''}${f.other ? `<div style="margin-top:2px">其他：${esc(f.other)}</div>` : ''}
    <div>${imgsHtml(f.photos)}</div></div>`;
}

// 阶段详情：大幅去噪留白，去掉无意义的“第1次送审·演示文件·纸质·时间”冗余行
function stageDetail(p, key) {
  const s = p.stages[key] || {};
  let h = '';

  // 报会申请卡片（直报院长）
  if (s.apply) {
    const ap = s.apply;
    const isPending = ap.status === 'pending';
    const isScheduled = ap.status === 'scheduled';
    const isRejected = ap.status === 'rejected';
    h += `<div class="opinion" style="border-left-color:#8250df;background:#faf8ff">
      <div class="row">
        <span>📅 <b>报会申请（直报院长）</b></span>
        <span class="tag ${isScheduled ? 'green' : isRejected ? 'red' : 'purple'}">
          ${isScheduled ? '✅ 院长已排期' : isRejected ? '❌ 已退回' : '⏳ 待院长排期'}
        </span>
      </div>
      <div class="muted" style="margin-top:2px">
        申请人：${uname(ap.applicant || p.leader)} · 接收领导：${uname(ap.targetLeader || 'u1')}（院长） · ${ap.submittedAt || ''}
      </div>
      <div style="margin-top:4px;font-size:13px">
        <b>期望时间：</b>${esc(ap.prefQuick || fmtAppt(ap.prefTime))}
      </div>
      ${ap.materials && ap.materials.length ? `<div style="margin-top:2px;font-size:12px;color:#475569"><b>就绪材料：</b>${ap.materials.map((m) => `<span class="tag">${esc(m)}</span>`).join('')}</div>` : ''}
      ${ap.note ? `<div style="margin-top:2px;font-size:13px;color:#334155"><b>汇报说明：</b>${esc(ap.note)}</div>` : ''}
      ${isScheduled ? `
        <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d8b4fe;color:#1a7f37;font-size:13px">
          <b>🗓 排期确认：</b>${fmtAppt(ap.scheduledTime)} · 地点：${esc(ap.location || '三楼大会议室')}
          ${ap.attendees && ap.attendees.length ? `<div class="muted" style="margin-top:2px">参会人员：${ap.attendees.map(uname).join('、')}</div>` : ''}
          ${ap.deanOpinion ? `<div style="margin-top:2px;color:#334155"><b>院长批示：</b>${esc(ap.deanOpinion)}</div>` : ''}
        </div>` : ''}
      ${isRejected ? `
        <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #fca5a5;color:#cf222e;font-size:13px">
          <b>退回原因：</b>${esc(ap.rejectReason || '材料需补充完善')}
        </div>` : ''}
      <div style="text-align:right;margin-top:6px">
        ${U(me).role === '院长' && isPending ? `<button class="btn sm purple" onclick="deanScheduleModal('${p.id}','${key}')">🗓 审批并排期</button>` : ''}
        ${isTeam(p) && (isPending || isRejected) ? `<span class="edit-link" onclick="applyMeetingModal('${p.id}','${key}')">✏️ ${isRejected ? '重新报会' : '修改申请'}</span>` : ''}
      </div>
    </div>`;
  }

  if (s.meeting) {
    const m = s.meeting;
    h += `<div class="opinion meeting">
      <div class="row"><span>🗓 <b>${fmtAppt(m.time) || '时间未定'}</b></span>${isTeam(p) ? `<span class="edit-link" onclick="meetingModal('${p.id}','${key}')">✏️ 修改纪要</span>` : ''}</div>
      ${m.location ? `<div class="muted" style="margin-top:2px">地点：${esc(m.location)}</div>` : ''}
      <div class="muted" style="margin-top:2px">参会：${m.attendees.map(uname).join('、') || '—'}</div>
      ${m.deanOpinion ? `<div style="margin-top:4px;color:#8250df"><b>院长批示：</b>${esc(m.deanOpinion)}</div>` : ''}
      ${m.opinion ? `<div style="margin-top:4px"><b>会议意见：</b>${esc(m.opinion)}</div>` : ''}
      ${m.implement ? `<div style="margin-top:2px"><b>落实情况：</b>${esc(m.implement)}</div>` : ''}
      <div>${imgsHtml(m.photos)}</div></div>`;
  }
  p.reviews.filter((r) => r.stage === key).forEach((r) => {
    r.items.forEach((it) => {
      const mineDone = it.uid === me && it.status === 'done';
      const isYuanZong = U(me).role === '院总';
      h += `<div class="stage-item">
        <div class="row" style="font-size:14px">
          <span><b>${uname(it.uid)}</b> <small class="muted">（${U(it.uid).role}）</small></span>
          ${statusTag(it)}
        </div>
        ${fbSummary(it.feedback)}
        ${mineDone ? `<div style="text-align:right;margin-top:2px">
          <span class="edit-link" onclick="feedbackModal('${p.id}','${r.id}')">✏️ 修改意见</span>
          ${isYuanZong ? `<span class="edit-link" onclick="notifyModal('${p.id}')">📢 通知所内各级审查人员</span>` : ''}
        </div>` : ''}
      </div>`;
    });
  });
  return h;
}

// 方案内容卡片：单版本时不显示“第1版”，多版本时才显示版本和说明
function renderSchemeCard(p) {
  const vs = p.versions;
  const isMulti = vs.length > 1;
  const cur = vs[vs.length - 1];
  const two = p.category === '控规';

  const bodyHtml = (v, isOld) => `
    <div class="ver ${!isMulti ? 'single' : isOld ? 'old' : ''}">
      ${isMulti ? `<div class="row"><b>第 ${v.no} 版</b><span class="muted">🕒 ${v.at} · ${uname(v.by)}</span></div>` : ''}
      ${isMulti && v.note ? `<div class="note">📝 ${esc(v.note)}</div>` : ''}
      ${v.text ? `<div style="margin:4px 0">${esc(v.text)}</div>` : ''}
      ${v.clause ? `<span class="tag">${BASIS[p.category] || ''}${v.clause}</span>` : ''}
      ${two ? `<div class="muted" style="margin-top:6px">用地图</div>${imgsHtml(v.imgs.a) || '<span class="muted">—</span>'}
               <div class="muted" style="margin-top:4px">指标表</div>${imgsHtml(v.imgs.b) || '<span class="muted">—</span>'}`
            : `<div>${imgsHtml(v.imgs.a)}</div>`}
    </div>`;

  return `<div class="card">
    ${bodyHtml(cur, false)}
    ${isMulti ? `<details><summary>查看历史方案（${vs.length - 1} 个早期版本）</summary>${vs.slice(0, -1).reverse().map((v) => bodyHtml(v, true)).join('')}</details>` : ''}
  </div>`;
}

function viewProject(p) {
  if (!p) return '<div class="empty">项目不存在</div>';
  if (!canSee(p, me)) return '<div class="empty">🔒 你不在该项目的公开范围内</div>';
  const keys = path(p), cur = curStage(p), def = STAGES[cur] || {}, team = isTeam(p);
  const sCur = p.stages[cur] || {};
  const isDean = U(me).role === '院长';
  const hasApply = !!sCur.apply;
  const isAppliedPending = hasApply && sCur.apply.status === 'pending';
  const isAppliedScheduled = hasApply && sCur.apply.status === 'scheduled';

  // 院长专属待排期提示卡片
  let deanCard = '';
  if (isDean && isAppliedPending) {
    deanCard = `<div class="card" style="border:1.5px solid #8250df;background:#faf8ff">
      <div class="row">
        <b>🔔 报会排期待审批</b>
        <span class="tag purple">${def.name}</span>
      </div>
      <div class="muted" style="margin-top:6px">
        申请人：<b>${uname(sCur.apply.applicant || p.leader)}</b> · 期望时间：<b>${esc(sCur.apply.prefQuick || fmtAppt(sCur.apply.prefTime) || '尽快安排')}</b>
      </div>
      ${sCur.apply.note ? `<div style="margin-top:4px;font-size:13px;color:#334155"><b>申请说明：</b>${esc(sCur.apply.note)}</div>` : ''}
      <button class="btn purple block" onclick="deanScheduleModal('${p.id}','${cur}')">🗓 院长审批并排期</button>
    </div>`;
  }

  let act = '';
  if (team) {
    const revert = p.stageIdx > 0 ? `<button class="btn gray" onclick="revertStage(P('${p.id}'))">↩ 撤回上一阶段</button>` : '';
    if (finished(p)) {
      act = `<div class="card"><b>✅ 全部阶段已完成</b><div style="margin-top:8px">${revert}</div></div>`;
    } else {
      let meetingBtns = '';
      if (def.type === 'meeting') {
        if (cur === 's2' || def.name.includes('技术审查会')) {
          if (!hasApply || sCur.apply.status === 'rejected') {
            meetingBtns = `<button class="btn purple" onclick="applyMeetingModal('${p.id}','${cur}')">📅 申请报会（直报院长）</button>`;
          } else if (isAppliedPending) {
            meetingBtns = `<button class="btn ghost purple" onclick="applyMeetingModal('${p.id}','${cur}')">⏳ 待院长排期（查看/修改报会）</button>`;
          } else if (isAppliedScheduled) {
            meetingBtns = `<button class="btn purple" onclick="meetingModal('${p.id}','${cur}')">📝 录入/修改会议纪要</button>`;
          }
        }
        if (!meetingBtns) {
          meetingBtns = `<button class="btn" onclick="meetingModal('${p.id}')">📝 会议信息</button>`;
        }
      }

      act = `<div class="card">
        <div class="row"><b>当前阶段：${def.name}</b><span class="tag blue">${def.type === 'meeting' ? '会议节点' : '审查节点'}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${meetingBtns}
          ${def.type === 'review' || def.preReview ? `<button class="btn" onclick="reviewModal('${p.id}')">📤 送审</button>` : ''}
          <button class="btn green" onclick="completeStage(P('${p.id}'))">✔ 本阶段完成</button>
          ${def.optional ? `<button class="btn gray" onclick="completeStage(P('${p.id}'),true)">跳过（非必选）</button>` : ''}
          ${revert}
        </div>
      </div>`;
    }
  }

  const vs = p.versions;
  const otherMembers = p.members.filter((m) => m !== p.leader);

  return `<div class="card">
    <div class="row">
      <b style="font-size:17px">${esc(p.alias || p.name)}</b>
      <span class="tag">${p.category}</span>
    </div>
    <div class="muted" style="margin-top:4px">${esc(p.name)}</div>
    ${imgsHtml(p.nameImgs)}
    <div class="muted" style="margin-top:6px">
      项目组：<b style="color:#b7791f">👑 ${uname(p.leader)}（负责人）</b>${otherMembers.length ? ' · ' + otherMembers.map(uname).join('、') : ''}
    </div>
    <div class="muted" style="margin-top:2px">公开：${p.visible.map(uname).join('、')}</div>
    ${team ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #f0f2f5;text-align:right">
      <span class="edit-link" onclick="editProjectModal('${p.id}')">✏️ 修改项目基本信息</span>
    </div>` : ''}
  </div>

  ${deanCard}
  ${act}

  <h2 class="row">
    <span>项目主要内容 ${vs.length > 1 ? `<span class="tag green">第 ${latest(p).no} 版</span>` : ''}</span>
    ${team ? `<button class="btn sm" onclick="versionModal('${p.id}')">＋ 上传新方案</button>` : ''}
  </h2>
  ${renderSchemeCard(p)}

  <h2>流程进度</h2>
  <div class="card">
    <ul class="timeline">
      ${keys.map((k, i) => {
        const s = p.stages[k] || {};
        const cls = s.skipped ? 'skip' : i < p.stageIdx ? 'done' : i === p.stageIdx ? 'cur' : '';
        return `<li class="${cls}">
          <span class="sname">${STAGES[k].name}</span>
          ${STAGES[k].optional ? '<span class="tag">可选</span>' : ''}
          <span class="tag">${STAGES[k].type === 'review' ? '审查' : '会议'}</span>
          ${stageDetail(p, k)}
        </li>`;
      }).join('')}
    </ul>
    <div style="margin-top:14px;padding-top:12px;border-top:1px dashed #e1e4e8;text-align:center">
      <span style="font-size:13px;color:#1f6feb;cursor:pointer;font-weight:500" onclick="historyModal('${p.id}')">📜 查看完整流转与操作记录 (${p.log.length})</span>
    </div>
  </div>`;
}

// ===== 启动 =====
$('#userSwitch').innerHTML = USERS.map((u) => `<option value="${u.id}" ${u.id === me ? 'selected' : ''}>${u.name}（${u.role}）</option>`).join('');
$('#userSwitch').onchange = (e) => { me = e.target.value; localStorage.setItem(KEY + '-me', me); render(); };
$$('#tabbar button[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
render();
