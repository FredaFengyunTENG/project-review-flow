// ===== 页面视图 =====

let memberState = []; // 当前编辑中的项目组成员列表 [uid1, uid2...] 第一位为负责人

function render() {
  const todoBtn = $('#tabbar button[data-go="todo"]');
  if (todoBtn) {
    if (U(me).role === '院长') todoBtn.textContent = '👑 院长看板';
    else if (U(me).role === '院总') todoBtn.textContent = '🏛 院总看板';
    else if (U(me).role === '所长') todoBtn.textContent = `🏢 ${U(me).dept || '本所'}看板`;
    else todoBtn.textContent = '📋 待办';
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
  else if (route.name === 'bulletin') v.innerHTML = viewTechnicalBulletin();
  else if (route.name === 'projects') v.innerHTML = viewProjects();
  else if (route.name === 'new') { v.innerHTML = viewNew(); bindNew(); }
  else if (route.name === 'project') v.innerHTML = viewProject(P(route.arg));
}

function statusTag(it) {
  if (it.status === 'done') return '<span class="tag green">已反馈</span>';
  if (it.status === 'accepted') return `<span class="tag blue">已接收${it.appointment ? ' · 约 ' + fmtAppt(it.appointment) : ''}</span>`;
  return '<span class="tag orange">待接收</span>';
}

// ===== 王院长专属看板 =====
function viewDeanBoard() {
  const totalProjects = DB.projects.length;

  // 各类别统计
  const catCounts = {};
  CATEGORIES.filter((c) => c !== '其他（待开发）').forEach((c) => (catCounts[c] = 0));
  DB.projects.forEach((p) => {
    if (catCounts[p.category] !== undefined) catCounts[p.category]++;
  });

  // 各所队分布统计
  const deptCounts = {};
  DEPTS.forEach((d) => (deptCounts[d] = 0));
  DB.projects.forEach((p) => {
    const d = p.dept || '规划一所';
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

  const applies = deanPendingApplies();
  const notes = deanPendingNotes();
  const myTasks = myReviewTasks();

  let h = `
  <div class="card" style="border:1.5px solid #8250df;background:linear-gradient(135deg, #faf8ff 0%, #f3e8ff 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#581c87">👑 王院长 · 分院全景看板</b>
        <div class="muted" style="margin-top:2px;font-size:12px">分院宏观把控 · 报会统筹排期 · 直通车预约沟通</div>
      </div>
      <span class="tag purple" style="font-size:12px;font-weight:600">全院共 ${totalProjects} 项项目</span>
    </div>

    <div class="stat-grid" style="margin-top:12px">
      <div class="stat-item">
        <div class="stat-num" style="color:#7c3aed">${totalProjects}</div>
        <div class="stat-lbl">分院总项目数</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#0969da">${catCounts['控规修改'] || 0}</div>
        <div class="stat-lbl">控规修改类</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#1a7f37">${catCounts['控规优化调整'] || 0}</div>
        <div class="stat-lbl">控规优化调整</div>
      </div>
    </div>

    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <span class="tag">${DEPTS[0]}：<b>${deptCounts[DEPTS[0]] || 0}</b> 项</span>
      <span class="tag">${DEPTS[1]}：<b>${deptCounts[DEPTS[1]] || 0}</b> 项</span>
      <span class="tag">${DEPTS[2]}：<b>${deptCounts[DEPTS[2]] || 0}</b> 项</span>
      <span class="tag">控规新编：<b>${catCounts['控规'] || 0}</b> 项</span>
    </div>
  </div>`;

  // 1. 待办层级一：分院技术审查会报会（只报数量与概要，点进去看详细项目）
  const appliesByDept = {};
  applies.forEach(({ p }) => {
    const d = p.dept || '规划一所';
    appliesByDept[d] = (appliesByDept[d] || 0) + 1;
  });
  const appliesDeptSummary = Object.entries(appliesByDept).map(([d, c]) => `${d} ${c} 项`).join('、');
  const appliesProjectNames = applies.map(({ p }) => esc(p.alias || p.name)).join('、');

  h += `
  <div class="row" style="margin:20px 0 8px">
    <b style="font-size:15px;color:#1e293b">⚡ 待办一：分院技术审查会报会</b>
    <span class="muted" style="font-size:12px">累计开会机制</span>
  </div>

  <div class="card click" style="border:1.5px solid ${applies.length >= 2 ? '#f59e0b' : '#d8b4fe'};background:${applies.length >= 2 ? '#fffdf7' : '#faf8ff'};padding:14px" onclick="go('dean-meetings')">
    <div class="row">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px">⚡</span>
        <b style="font-size:15px;color:#1e293b">报会项目待排期</b>
        ${applies.length >= 2 ? '<span class="tag orange" style="font-weight:600">已达集中开会建议量</span>' : ''}
      </div>
      <span class="tag ${applies.length ? 'purple' : 'gray'}" style="font-weight:700;font-size:13px">${applies.length} 项</span>
    </div>

    ${applies.length ? `
      <div style="margin-top:8px;font-size:13px;color:#334155;line-height:1.5">
        当前共有 <b style="color:#7c3aed;font-size:15px">${applies.length}</b> 个项目申请报会${appliesDeptSummary ? `（来自 ${appliesDeptSummary}）` : ''}。
        ${applies.length >= 2 ? '<br><span style="color:#b45309;font-weight:600">💡 报会数量已达到集中开会建议量，可合并排期集中开会。</span>' : ''}
      </div>
      <div style="margin-top:6px;font-size:12px;color:#64748b;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">
        📌 待审项目：${appliesProjectNames}
      </div>
      <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
        <span style="color:#7c3aed;font-size:12.5px;font-weight:600">点击进入查看详细项目清单与排期 →</span>
        <button class="btn sm purple" onclick="event.stopPropagation();go('dean-meetings')">进入查看 (${applies.length})</button>
      </div>
    ` : `
      <div style="margin-top:6px;font-size:13px;color:#8c959f">
        当前暂无待开会的报会项目申请。各项目自审完成后将直报至此。
      </div>
    `}
  </div>`;

  // 2. 待办层级二：院长直通车小纸条（只报数量与概要，点进去看详细内容与回复）
  const urgentNotesCount = notes.filter(({ note }) => note.urgent).length;
  const notesByDept = {};
  notes.forEach(({ p }) => {
    const d = p.dept || '规划一所';
    notesByDept[d] = (notesByDept[d] || 0) + 1;
  });
  const notesDeptSummary = Object.entries(notesByDept).map(([d, c]) => `${d} ${c} 条`).join('、');
  const latestNote = notes[0];

  h += `
  <div class="row" style="margin:20px 0 8px">
    <b style="font-size:15px;color:#1e293b">✉️ 待办二：院长直通车（小纸条）</b>
    <span class="muted" style="font-size:12px">项目组特殊急件请示</span>
  </div>

  <div class="card click" style="border:1.5px solid ${urgentNotesCount > 0 ? '#fca5a5' : '#8250df'};background:${urgentNotesCount > 0 ? '#fffbfb' : '#fff'};padding:14px" onclick="go('dean-notes')">
    <div class="row">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px">✉️</span>
        <b style="font-size:15px;color:#1e293b">直通车小纸条待回复</b>
        ${urgentNotesCount > 0 ? `<span class="tag red" style="font-weight:600">🚨 包含 ${urgentNotesCount} 条加急</span>` : ''}
      </div>
      <span class="tag ${notes.length ? 'purple' : 'gray'}" style="font-weight:700;font-size:13px">${notes.length} 条</span>
    </div>

    ${notes.length ? `
      <div style="margin-top:8px;font-size:13px;color:#334155;line-height:1.5">
        收到 <b style="color:#7c3aed;font-size:15px">${notes.length}</b> 位项目团队成员递交的特殊请示${notesDeptSummary ? `（来自 ${notesDeptSummary}）` : ''}。
      </div>
      ${latestNote ? `
        <div style="margin-top:6px;font-size:12px;color:#64748b;background:#faf8ff;padding:6px 10px;border-radius:6px;border:1px solid #e9d5ff">
          📌 最近递送：来自 <b>${uname(latestNote.note.by)}</b>（${esc(latestNote.p.alias || latestNote.p.name)}）${latestNote.note.urgent ? ' · <span style="color:#cf222e;font-weight:600">加急请示</span>' : ''}
        </div>
      ` : ''}
      <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
        <span style="color:#8250df;font-size:12.5px;font-weight:600">点击进入查看小纸条内容与预约回复 →</span>
        <button class="btn sm purple" onclick="event.stopPropagation();go('dean-notes')">进入查看 (${notes.length})</button>
      </div>
    ` : `
      <div style="margin-top:6px;font-size:13px;color:#8c959f">
        当前暂无待回复的直通车小纸条。各所成员如有重大疑难可随时在项目页递交。
      </div>
    `}
  </div>`;

  // 3. 待办层级三：个人待审事项（如果有）
  if (myTasks.length) {
    h += `
    <div class="row" style="margin:20px 0 8px">
      <b style="font-size:15px;color:#1e293b">📝 待办三：待我常规审查把关</b>
      <span class="tag blue">${myTasks.length} 项</span>
    </div>
    <div class="card click" style="border:1.5px solid #d0e2ff;background:#f8fbff;padding:12px 14px" onclick="go('projects')">
      <div class="row">
        <div>
          <b style="font-size:14px;color:#0969da">待王院长亲自签署意见的项目成果</b>
          <div class="muted" style="margin-top:2px;font-size:12px">涉及 ${myTasks.map(({ p }) => esc(p.alias || p.name)).join('、')}</div>
        </div>
        <span style="color:#1f6feb;font-size:12px;font-weight:500">去审查 →</span>
      </div>
    </div>`;
  }

  // 4. 辅助层级：技术公告与全院项目库
  h += `
  <div style="margin-top:22px;display:flex;gap:8px;flex-direction:column">
    <div class="card click" style="border:1px solid #d0e2ff;background:#f0f7ff;padding:10px 14px" onclick="go('bulletin')">
      <div class="row">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:15px">📢</span>
          <b style="font-size:13.5px;color:#0969da">院技术公告板 · 审查新规（${(DB.bulletins || []).length} 条生效中）</b>
        </div>
        <span style="color:#1f6feb;font-size:12px;font-weight:500">查看 →</span>
      </div>
    </div>

    <button class="btn gray block" onclick="go('projects')">📁 浏览分院全部规划项目 (${totalProjects} 项)</button>
  </div>`;

  return h;
}

// ===== 王院长二级页面：分院技术审查会详细报会清单与排期 =====
function viewDeanMeetings() {
  const applies = deanPendingApplies();

  let h = `
  <div class="row" style="margin-bottom:12px">
    <button class="btn sm gray" onclick="go('todo')">← 返回院长看板</button>
    <span class="muted" style="font-size:12px">👑 王院长 · 报会审批与排期</span>
  </div>

  <div class="card" style="border:1.5px solid #8250df;background:linear-gradient(135deg, #faf8ff 0%, #f3e8ff 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#581c87">⚡ 分院技术审查会 · 报会清单</b>
        <div class="muted" style="margin-top:2px;font-size:12px">项目组直报院长 · 集中合并开会或单独排期</div>
      </div>
      <span class="tag purple" style="font-size:13px;font-weight:700">${applies.length} 个项目申请</span>
    </div>
  </div>`;

  if (applies.length >= 2) {
    h += `
    <div class="card" style="border:1.5px solid #f59e0b;background:#fffbeb;padding:12px">
      <div style="font-weight:700;font-size:14px;color:#b45309">
        💡 报会数量已达集中开会标准（已累计 ${applies.length} 个项目）
      </div>
      <div style="font-size:12.5px;color:#92400e;margin-top:4px;line-height:1.4">
        建议统一排定时间组织集中审查会，一并通知相关所队参会人员，提高领导会商效率。
      </div>
      <button class="btn purple block" style="margin-top:10px" onclick="deanBatchScheduleModal()">🗓 一键合并排期集中开会（${applies.length}个项目合并上会）</button>
    </div>`;
  } else if (applies.length === 1) {
    h += `<div class="card" style="background:#f8fafc;padding:8px 12px;font-size:12.5px;color:#475569">
      当前已累计 1 项报会申请（通常累计 2~3 项集中开会，亦可随时单独排期开会）。
    </div>`;
  }

  if (!applies.length) {
    h += `<div class="empty">暂无待开会的报会申请 ☕<div style="margin-top:10px"><button class="btn sm gray" onclick="go('todo')">返回院长看板</button></div></div>`;
  } else {
    h += applies.map(({ p, key, apply }) => `
      <div class="card" style="border:1.5px solid #d8b4fe;background:#fff">
        <div class="row">
          <div>
            <b style="font-size:15px;color:#1e293b">${esc(p.alias || p.name)}</b>
            <span class="muted" style="font-size:12px">（${esc(p.name)}）</span>
          </div>
          <span class="tag purple">${p.dept || '规划一所'}</span>
        </div>
        <div class="muted" style="margin-top:4px;font-size:12.5px">
          报会申请人：<b>${uname(apply.applicant || p.leader)}</b> · 提交时间：${apply.submittedAt || ''}
        </div>
        <div style="margin-top:6px;font-size:13px">
          <b>期望开会时间：</b><span style="color:#7c3aed;font-weight:600">${esc(apply.prefQuick || fmtAppt(apply.prefTime))}</span>
        </div>
        ${apply.materials && apply.materials.length ? `
          <div style="margin-top:4px;font-size:12px;color:#475569">
            汇报材料：${apply.materials.map((m) => `<span class="tag">${esc(m)}</span>`).join('')}
          </div>` : ''}
        ${apply.note ? `
          <div style="margin-top:6px;font-size:12.5px;color:#334155;background:#faf8ff;padding:6px 10px;border-radius:6px;border:1px solid #e9d5ff">
            <b>自审说明：</b>${esc(apply.note)}
          </div>` : ''}
        <div class="row" style="margin-top:12px;padding-top:8px;border-top:1px dashed #e2e8f0">
          <span class="edit-link" onclick="go('project','${p.id}')" style="margin-left:0">查看所属项目 →</span>
          <button class="btn sm purple" onclick="deanScheduleModal('${p.id}','${key}')">🗓 审批并单独排期</button>
        </div>
      </div>`).join('');
  }

  return h;
}

// ===== 王院长二级页面：院长直通车小纸条待办清单与回复 =====
function viewDeanNotes() {
  const notes = deanPendingNotes();

  let h = `
  <div class="row" style="margin-bottom:12px">
    <button class="btn sm gray" onclick="go('todo')">← 返回院长看板</button>
    <span class="muted" style="font-size:12px">👑 王院长直通车</span>
  </div>

  <div class="card" style="border:1.5px solid #8250df;background:linear-gradient(135deg, #faf8ff 0%, #f3e8ff 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#581c87">✉️ 院长直通车 · 小纸条待办</b>
        <div class="muted" style="margin-top:2px;font-size:12px">各所技术人员直接递交的特殊急件与请示 · 支持预约面谈回复</div>
      </div>
      <span class="tag purple" style="font-size:13px;font-weight:700">${notes.length} 条待回复</span>
    </div>
  </div>`;

  if (!notes.length) {
    h += `<div class="empty">暂无待回复的直通车小纸条 ☕<div style="margin-top:10px"><button class="btn sm gray" onclick="go('todo')">返回院长看板</button></div></div>`;
  } else {
    h += notes.map(({ p, note }) => `
      <div class="card" style="border:1.5px solid ${note.urgent ? '#fca5a5' : '#8250df'};background:#fff">
        <div class="row">
          <div>
            <b style="font-size:15px;color:#1e293b">${esc(p.alias || p.name)}</b>
            <span class="tag ${note.urgent ? 'red' : 'purple'}">${note.urgent ? '🚨 加急请示' : '✉️ 小纸条'}</span>
          </div>
          <span class="tag">${p.dept || '规划一所'}</span>
        </div>
        <div class="muted" style="margin-top:4px;font-size:12.5px">
          递交人：<b>${uname(note.by)}</b> · 递送时间：${note.at}
        </div>
        <div style="margin-top:8px;font-size:13.5px;color:#1e293b;background:#faf8ff;padding:10px 12px;border-radius:8px;border:1px solid #e9d5ff;line-height:1.5">
          📝 ${esc(note.text)}
        </div>
        ${note.photos && note.photos.length ? `<div style="margin-top:6px">${imgsHtml(note.photos)}</div>` : ''}
        <div class="row" style="margin-top:12px;padding-top:8px;border-top:1px dashed #e2e8f0">
          <span class="edit-link" onclick="go('project','${p.id}')" style="margin-left:0">查看所属项目 →</span>
          <button class="btn sm purple" onclick="deanReplyNoteModal('${p.id}','${note.id}')">👉 回复预约沟通时间（啥时候来）</button>
        </div>
      </div>`).join('');
  }

  return h;
}

// ===== 李院总专属看板（分层级总览与下钻）=====
function viewChiefEngineerBoard() {
  const allProjects = DB.projects.filter((p) => canSee(p, me));

  // 院总审查任务
  const urgentTasks = [];
  const normalTasks = [];
  allProjects.forEach((p) => {
    p.reviews.forEach((r) => {
      r.items.forEach((it) => {
        if (it.uid === me && it.status !== 'done') {
          if (r.parallel) urgentTasks.push({ p, r, it });
          else normalTasks.push({ p, r, it });
        }
      });
    });
  });

  // 各所自审中（下周工作预判）
  const upcomingProjects = allProjects.filter((p) => {
    const cur = curStage(p);
    if (cur !== 's1' && cur !== 's3') return false;
    const hasMine = p.reviews.some((r) => r.stage === cur && r.items.some((i) => i.uid === me));
    return !hasMine && !finished(p);
  });

  // 普适性技术问题
  const issues = DB.commonIssues || [];
  const broadcastedIssuesCount = issues.filter((i) => i.broadcasted).length;
  const latestIssue = issues[0];

  let h = `
  <div class="card" style="border:1.5px solid #1f6feb;background:linear-gradient(135deg, #f0f7ff 0%, #e6f0fd 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#1e40af">🏛 李院总 · 全院技术把关大盘</b>
        <div class="muted" style="margin-top:2px;font-size:12px">全院技术最高把关 · 待办分类分层 · 普适性问题提炼</div>
      </div>
      <span class="tag blue" style="font-size:12px;font-weight:600">全院把关 ${allProjects.length} 项</span>
    </div>

    <div class="stat-grid" style="margin-top:12px">
      <div class="stat-item click" onclick="go('ce-reviews')" style="cursor:pointer">
        <div class="stat-num" style="color:#cf222e">${urgentTasks.length}</div>
        <div class="stat-lbl">🚨 紧急加急待审</div>
      </div>
      <div class="stat-item click" onclick="go('ce-reviews')" style="cursor:pointer">
        <div class="stat-num" style="color:#0969da">${normalTasks.length}</div>
        <div class="stat-lbl">⏳ 常规待审项目</div>
      </div>
      <div class="stat-item click" onclick="go('ce-issues')" style="cursor:pointer">
        <div class="stat-num" style="color:#7c3aed">${issues.length}</div>
        <div class="stat-lbl">💡 普适性问题提炼</div>
      </div>
    </div>
  </div>`;

  // 1. 待办层级一：待我技术审查把关（紧急加急 + 常规待审）
  const totalTasksCount = urgentTasks.length + normalTasks.length;
  h += `
  <div class="row" style="margin:20px 0 8px">
    <b style="font-size:15px;color:#1e293b">⚡ 待办一：待我技术审查把关</b>
    <span class="muted" style="font-size:12px">逐级审查到院总</span>
  </div>

  <div class="card click" style="border:1.5px solid ${urgentTasks.length ? '#cf222e' : (normalTasks.length ? '#0969da' : '#cbd5e1')};background:${urgentTasks.length ? '#fff8f8' : '#fff'};padding:14px" onclick="go('ce-reviews')">
    <div class="row">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px">${urgentTasks.length ? '🚨' : '⏳'}</span>
        <b style="font-size:15px;color:#1e293b">待审成果签批</b>
        ${urgentTasks.length ? `<span class="tag red" style="font-weight:700">含 ${urgentTasks.length} 项加急</span>` : ''}
        ${normalTasks.length ? `<span class="tag blue">${normalTasks.length} 项常规</span>` : ''}
      </div>
      <span class="tag ${totalTasksCount ? 'red' : 'gray'}" style="font-weight:700;font-size:13px">${totalTasksCount} 项待审</span>
    </div>

    ${totalTasksCount ? `
      <div style="margin-top:8px;font-size:13px;color:#334155;line-height:1.5">
        当前共有 <b style="color:#cf222e;font-size:15px">${totalTasksCount}</b> 个项目成果等待院总出具技术把关意见。
      </div>
      ${urgentTasks.length ? `
        <div style="margin-top:6px;font-size:12px;color:#991b1b;background:#fee2e2;padding:6px 10px;border-radius:6px;border:1px solid #fca5a5">
          ⚡ <b>优先保障：</b>${urgentTasks.map(({ p, r }) => `${esc(p.alias || p.name)}（${p.dept || '规划一所'} · ${esc(r.reason || '加急')}）`).join('；')}
        </div>
      ` : ''}
      ${normalTasks.length ? `
        <div style="margin-top:4px;font-size:12px;color:#475569;background:#f8fafc;padding:5px 10px;border-radius:6px;border:1px solid #e2e8f0">
          ⏳ <b>常规待审：</b>${normalTasks.map(({ p }) => `${esc(p.alias || p.name)}（${p.dept || '规划一所'}）`).join('、')}
        </div>
      ` : ''}
      <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
        <span style="color:#0969da;font-size:12.5px;font-weight:600">点击进入审查工作台签批 →</span>
        <button class="btn sm ${urgentTasks.length ? 'red' : 'purple'}" onclick="event.stopPropagation();go('ce-reviews')">进入审查 (${totalTasksCount})</button>
      </div>
    ` : `
      <div style="margin-top:6px;font-size:13px;color:#8c959f">
        暂无待院总把关的审查项目 ☕ 各所自审完成后将陆续送审。
      </div>
    `}
  </div>`;

  // 2. 待办层级二：各所自审中·下周负荷预判
  h += `
  <div class="row" style="margin:20px 0 8px">
    <b style="font-size:15px;color:#1e293b">👀 待办二：各所自审预报（下周预判）</b>
    <span class="muted" style="font-size:12px">工作量前瞻预看</span>
  </div>

  <div class="card click" style="border:1px solid #cbd5e1;background:#f8fafc;padding:14px" onclick="go('ce-upcoming')">
    <div class="row">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px">👀</span>
        <b style="font-size:15px;color:#334155">各所自审进行中</b>
      </div>
      <span class="tag gray" style="font-weight:700;font-size:13px">${upcomingProjects.length} 项</span>
    </div>

    ${upcomingProjects.length ? `
      <div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.5">
        所内组长/所总正在自审中，预计近期将陆续送审院总把关。
      </div>
      <div style="margin-top:6px;font-size:12px;color:#64748b;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">
        📌 即将送审：${upcomingProjects.map((p) => `${esc(p.alias || p.name)}（${p.dept || '规划一所'}）`).join('、')}
      </div>
      <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
        <span style="color:#475569;font-size:12.5px;font-weight:500">点击可提前预看方案图纸 →</span>
        <button class="btn sm gray" onclick="event.stopPropagation();go('ce-upcoming')">查看自审进度 (${upcomingProjects.length})</button>
      </div>
    ` : `
      <div style="margin-top:6px;font-size:13px;color:#8c959f">
        暂无正在所内自审的项目预报。
      </div>
    `}
  </div>`;

  // 3. 待办层级三：普适性技术问题收集板
  h += `
  <div class="row" style="margin:20px 0 8px">
    <b style="font-size:15px;color:#1e293b">💡 待办三：普适性技术问题收集板</b>
    <span class="muted" style="font-size:12px">知识沉淀与全院统一</span>
  </div>

  <div class="card click" style="border:1.5px solid #8250df;background:#faf8ff;padding:14px" onclick="go('ce-issues')">
    <div class="row">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px">💡</span>
        <b style="font-size:15px;color:#581c87">共性技术要点沉淀库</b>
      </div>
      <span class="tag purple" style="font-weight:700;font-size:13px">${issues.length} 条沉淀</span>
    </div>

    ${issues.length ? `
      <div style="margin-top:8px;font-size:13px;color:#334155;line-height:1.5">
        已从审查批注中自动提炼 <b style="color:#7c3aed;font-size:15px">${issues.length}</b> 条共性问题（其中 <b>${broadcastedIssuesCount}</b> 条已发全院，<b>${issues.length - broadcastedIssuesCount}</b> 条待发）。
      </div>
      ${latestIssue ? `
        <div style="margin-top:6px;font-size:12px;color:#64748b;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e9d5ff">
          📌 最新沉淀：<b>${esc(latestIssue.title)}</b>（适用【${esc(latestIssue.category)}】）
        </div>
      ` : ''}
      <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
        <span style="color:#7c3aed;font-size:12.5px;font-weight:600">点击进入修改内容与分发三个所 →</span>
        <button class="btn sm purple" onclick="event.stopPropagation();go('ce-issues')">进入收集板 (${issues.length})</button>
      </div>
    ` : `
      <div style="margin-top:6px;font-size:13px;color:#8c959f">
        暂无沉淀的共性技术问题。
      </div>
    `}
  </div>`;

  // 4. 辅助层级：技术公告发布与全院项目
  h += `
  <div style="margin-top:22px;display:flex;gap:8px;flex-direction:column">
    <div class="card click" style="border:1px solid #d0e2ff;background:#f0f7ff;padding:12px 14px" onclick="go('bulletin')">
      <div class="row">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:16px">📢</span>
          <b style="font-size:14px;color:#0969da">院技术公告发布台（${(DB.bulletins || []).length} 条生效中）</b>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn sm purple" onclick="event.stopPropagation();publishBulletinModal()">➕ 发布新规</button>
          <button class="btn sm ghost" onclick="event.stopPropagation();go('bulletin')">公告板 →</button>
        </div>
      </div>
    </div>

    <button class="btn gray block" onclick="go('projects')">📁 浏览全院规划项目库 (${allProjects.length} 项)</button>
  </div>`;

  return h;
}

// ===== 李院总二级页面：技术审查工作台 =====
function viewChiefEngineerReviews() {
  const allProjects = DB.projects.filter((p) => canSee(p, me));

  const curDept = ceFilter.dept || 'all';
  const curCat = ceFilter.cat || 'all';

  const filterProjects = allProjects.filter((p) => {
    if (curDept !== 'all' && (p.dept || '规划一所') !== curDept) return false;
    if (curCat !== 'all' && p.category !== curCat) return false;
    return true;
  });

  const urgentTasks = [];
  const normalTasks = [];
  filterProjects.forEach((p) => {
    p.reviews.forEach((r) => {
      r.items.forEach((it) => {
        if (it.uid === me && it.status !== 'done') {
          if (r.parallel) urgentTasks.push({ p, r, it });
          else normalTasks.push({ p, r, it });
        }
      });
    });
  });

  let h = `
  <div class="row" style="margin-bottom:12px">
    <button class="btn sm gray" onclick="go('todo')">← 返回院总看板</button>
    <span class="muted" style="font-size:12px">🏛 院总技术审查工作台</span>
  </div>

  <div class="card" style="border:1.5px solid #1f6feb;background:linear-gradient(135deg, #f0f7ff 0%, #e6f0fd 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#1e40af">⚡ 待我技术审查把关成果清单</b>
        <div class="muted" style="margin-top:2px;font-size:12px">包含加急优先签批与常规逐级把关项目</div>
      </div>
      <span class="tag red" style="font-size:13px;font-weight:700">共 ${urgentTasks.length + normalTasks.length} 项</span>
    </div>
  </div>

  <!-- 多维度筛选条（三个所队 + 类别） -->
  <div class="card" style="padding:10px 12px;margin-bottom:12px">
    <div style="font-size:12px;color:#57606a;margin-bottom:4px">按所队筛选：</div>
    <div class="filter-bar">
      ${[['all', '全部三个所'], ...DEPTS.map((d) => [d, d])].map(([v, label]) => `
        <span class="chip ${curDept === v ? 'on' : ''}" onclick="setCeFilter('dept','${v}')">${label}</span>`).join('')}
    </div>
    <div style="font-size:12px;color:#57606a;margin:8px 0 4px">按项目类型筛选：</div>
    <div class="filter-bar">
      ${[['all', '全部类型'], ...CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => [c, c])].map(([v, label]) => `
        <span class="chip ${curCat === v ? 'on' : ''}" onclick="setCeFilter('cat','${v}')">${label}</span>`).join('')}
    </div>
  </div>`;

  // 第一部分：🚨 待我紧急审查
  h += `<div class="row" style="margin:16px 0 6px">
    <b style="font-size:15px;color:#cf222e">🚨 待我加急审查（${urgentTasks.length}）</b>
    <span class="tag red">优先保障</span>
  </div>`;

  h += urgentTasks.length ? urgentTasks.map(({ p, r, it }) => `
    <div class="card click" style="border:1.5px solid #fca5a5;background:#fff5f5" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        <span class="tag red">同时审查·加急</span>
      </div>
      <div class="muted" style="margin-top:2px">${p.dept || '规划一所'} · ${p.category} · 送审人：${uname(p.leader)}</div>
      <div style="margin-top:4px;font-size:13px;color:#cf222e;font-weight:500">
        ⚡ 加急原因：${esc(r.reason || '紧急审议')}
      </div>
      <div style="margin-top:8px;color:#1f6feb;font-size:13px;font-weight:600">👉 点此填写院总技术把关意见</div>
    </div>`).join('') : '<div class="card empty" style="padding:12px 0;margin-bottom:8px">暂无紧急加急项目 ☕</div>';

  // 第二部分：⏳ 待我常规把关
  h += `<div class="row" style="margin:16px 0 6px">
    <b style="font-size:15px;color:#0969da">⏳ 待我常规把关（${normalTasks.length}）</b>
    <span class="tag blue">逐级审查已到院总</span>
  </div>`;

  h += normalTasks.length ? normalTasks.map(({ p, r, it }) => `
    <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        ${statusTag(it)}
      </div>
      <div class="muted" style="margin-top:2px">${p.dept || '规划一所'} · ${STAGES[r.stage].name} · ${uname(p.leader)} 送审</div>
      <div class="muted" style="margin-top:2px">成果形式：${esc(r.form)} · ${r.paper ? '纸质册子' : '电子档'}</div>
      <div style="margin-top:8px;color:#1f6feb;font-size:13px;font-weight:500">
        ${it.status === 'pending' ? '👉 点此接收' + (r.paper ? '并约送册时间' : '') : '👉 点此录入技术审查把关意见'}
      </div>
    </div>`).join('') : '<div class="card empty" style="padding:12px 0;margin-bottom:8px">暂无常规待审项目 ☕</div>';

  return h;
}

// ===== 李院总二级页面：各所自审中·下周负荷预判 =====
function viewChiefEngineerUpcoming() {
  const allProjects = DB.projects.filter((p) => canSee(p, me));

  const curDept = ceFilter.dept || 'all';

  const filterProjects = allProjects.filter((p) => {
    if (curDept !== 'all' && (p.dept || '规划一所') !== curDept) return false;
    return true;
  });

  const upcomingProjects = filterProjects.filter((p) => {
    const cur = curStage(p);
    if (cur !== 's1' && cur !== 's3') return false;
    const hasMine = p.reviews.some((r) => r.stage === cur && r.items.some((i) => i.uid === me));
    return !hasMine && !finished(p);
  });

  let h = `
  <div class="row" style="margin-bottom:12px">
    <button class="btn sm gray" onclick="go('todo')">← 返回院总看板</button>
    <span class="muted" style="font-size:12px">🏛 各所自审中预报</span>
  </div>

  <div class="card" style="border:1.5px solid #cbd5e1;background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#334155">👀 各所自审中 · 下周工作预判</b>
        <div class="muted" style="margin-top:2px;font-size:12px">所内组长/所总正在审理中 · 预计近期送审院总</div>
      </div>
      <span class="tag gray" style="font-size:13px;font-weight:700">${upcomingProjects.length} 项进行中</span>
    </div>
  </div>

  <!-- 多维度筛选条 -->
  <div class="card" style="padding:10px 12px;margin-bottom:12px">
    <div style="font-size:12px;color:#57606a;margin-bottom:4px">按所队筛选：</div>
    <div class="filter-bar">
      ${[['all', '全部三个所'], ...DEPTS.map((d) => [d, d])].map(([v, label]) => `
        <span class="chip ${curDept === v ? 'on' : ''}" onclick="setCeFilter('dept','${v}')">${label}</span>`).join('')}
    </div>
  </div>`;

  if (!upcomingProjects.length) {
    h += `<div class="empty">暂无符合条件的自审项目 ☕<div style="margin-top:10px"><button class="btn sm gray" onclick="go('todo')">返回院总看板</button></div></div>`;
  } else {
    h += upcomingProjects.map((p) => `
      <div class="card" style="border:1px solid #e2e8f0;background:#fff">
        <div class="row">
          <div>
            <b style="font-size:15px;color:#1e293b">${esc(p.alias || p.name)}</b>
            <span class="muted" style="font-size:12px">（${esc(p.name)}）</span>
          </div>
          <span class="tag purple">${p.dept || '规划一所'}</span>
        </div>
        <div class="muted" style="margin-top:4px;font-size:12.5px">
          当前阶段：<b>${STAGES[curStage(p)] ? STAGES[curStage(p)].name : ''}</b> · 负责人：${uname(p.leader)}
        </div>
        <div class="row" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0">
          <span class="muted" style="font-size:12px">预计近期流转至院总</span>
          <button class="btn sm ghost" onclick="go('project','${p.id}')">提前预看方案 →</button>
        </div>
      </div>`).join('');
  }

  return h;
}

// ===== 李院总二级页面：普适性技术问题收集板 =====
function viewChiefEngineerIssues() {
  const curDept = ceFilter.dept || 'all';
  const curCat = ceFilter.cat || 'all';

  const rawIssues = DB.commonIssues || [];
  const issues = rawIssues.filter((iss) => {
    if (curCat !== 'all' && iss.category !== curCat) return false;
    if (curDept !== 'all' && iss.dept !== '全院' && iss.dept !== curDept) return false;
    return true;
  });

  let h = `
  <div class="row" style="margin-bottom:12px">
    <button class="btn sm gray" onclick="go('todo')">← 返回院总看板</button>
    <button class="btn sm purple" onclick="newIssueModal()">＋ 新增注意点</button>
  </div>

  <div class="card" style="border:1.5px solid #8250df;background:linear-gradient(135deg, #faf8ff 0%, #f3e8ff 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#581c87">💡 普适性技术问题收集板</b>
        <div class="muted" style="margin-top:2px;font-size:12px">从项目审查中提炼典型问题 · 可修改后一键发送三个所</div>
      </div>
      <span class="tag purple" style="font-size:13px;font-weight:700">${issues.length} 条</span>
    </div>
  </div>

  <!-- 多维度筛选条 -->
  <div class="card" style="padding:10px 12px;margin-bottom:12px">
    <div style="font-size:12px;color:#57606a;margin-bottom:4px">按所队筛选：</div>
    <div class="filter-bar">
      ${[['all', '全部三个所'], ...DEPTS.map((d) => [d, d])].map(([v, label]) => `
        <span class="chip ${curDept === v ? 'on' : ''}" onclick="setCeFilter('dept','${v}')">${label}</span>`).join('')}
    </div>
    <div style="font-size:12px;color:#57606a;margin:8px 0 4px">按项目类型筛选：</div>
    <div class="filter-bar">
      ${[['all', '全部类型'], ...CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => [c, c])].map(([v, label]) => `
        <span class="chip ${curCat === v ? 'on' : ''}" onclick="setCeFilter('cat','${v}')">${label}</span>`).join('')}
    </div>
  </div>`;

  if (!issues.length) {
    h += `<div class="empty">暂无收集的普适性技术问题 ☕<div style="margin-top:10px"><button class="btn sm gray" onclick="go('todo')">返回院总看板</button></div></div>`;
  } else {
    h += issues.map((iss) => `
      <div class="issue-card" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px;background:#fff">
        <div class="row">
          <div>
            <span class="tag blue">${esc(iss.category)}</span>
            <span class="tag">${esc(iss.dept)}</span>
            <span class="tag ${iss.broadcasted ? 'green' : 'orange'}">${iss.broadcasted ? '📢 已发全院三个所' : '⏳ 待发全院'}</span>
          </div>
          <span class="muted" style="font-size:11px">${iss.createdAt}</span>
        </div>
        <div class="muted" style="margin-top:4px">来源项目：${esc(iss.pname)}</div>
        
        <div style="font-weight:700;font-size:14px;color:#1e293b;margin:6px 0 2px">⚠️ ${esc(iss.title)}</div>
        <div style="font-size:13px;color:#475569;line-height:1.45;background:#f8fafc;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0">
          ${esc(iss.problem)}
        </div>

        <div style="font-size:13px;color:#7c3aed;margin-top:6px;background:#faf5ff;padding:6px 8px;border-radius:6px;border:1px solid #e9d5ff;line-height:1.45">
          <b>💡 院总提示与把关要求：</b>${esc(iss.guide)}
        </div>

        <div class="row" style="margin-top:10px;padding-top:6px;border-top:1px dashed #e2e8f0">
          <div>
            ${iss.broadcasted ? `<span class="muted" style="font-size:12px">已推：${iss.broadcastScope.join('、')} (${iss.broadcastAt})</span>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn sm gray" onclick="editIssueModal('${iss.id}')">✏️ 修改内容</button>
            <button class="btn sm purple" onclick="broadcastIssueModal('${iss.id}')">📢 发送给三个所</button>
            <button class="btn sm gray" onclick="deleteCommonIssue('${iss.id}')" title="删除">🗑</button>
          </div>
        </div>
      </div>`).join('');
  }

  return h;
}

function setCeFilter(k, v) {
  ceFilter[k] = v;
  render();
}

// ===== 所长专属生产管理看板 =====
function viewDirectorBoard() {
  const dept = U(me).dept || '规划一所';
  const dProjects = deptProjects(dept);
  const myReviews = myReviewTasks();
  const meetingApplies = deptMeetingApplies(dept);

  // 阶段分布
  const s1Count = dProjects.filter((p) => curStage(p) === 's1').length;
  const s2Count = dProjects.filter((p) => curStage(p) === 's2').length;
  const s3PlusCount = dProjects.filter((p) => ['s3', 's4', 's5', 's6', 's7', 's8', 's9'].includes(curStage(p))).length;
  const doneCount = dProjects.filter((p) => finished(p)).length;

  // 待我把关的任务
  let myReviewHtml = '';
  if (myReviews.length) {
    myReviewHtml = `<div class="card" style="border:1.5px solid #0969da;background:#f8fbff">
      <div class="row">
        <b>🔥 待我把关审查（${myReviews.length} 项）</b>
        <span class="tag red">所长把关</span>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
        ${myReviews.map(({ p, r, it }) => `
          <div style="background:#fff;border:1px solid #d0e2ff;border-radius:8px;padding:9px 12px">
            <div class="row">
              <b>${esc(p.alias || p.name)}</b>
              <span class="tag blue">${esc(r.form)}</span>
            </div>
            <div class="muted" style="font-size:12px;margin-top:4px">
              送审节点：<b>${STAGES[r.stage].name}</b> · 负责人：<b>${uname(p.leader)}</b>
            </div>
            <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
              <button class="btn sm" onclick="go('project','${p.id}')">查看项目</button>
              <button class="btn sm green" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
                ${it.status === 'pending' ? '👉 接收审查' : '✍️ 填写审查意见'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  // 本所报会跟踪
  let meetingHtml = '';
  if (meetingApplies.length) {
    meetingHtml = `<div class="card" style="border:1.5px solid #8250df;background:#faf8ff">
      <div class="row">
        <b>📅 本所报会与推进追踪（${meetingApplies.length} 个）</b>
        <span class="tag purple">分院技术审查会</span>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
        ${meetingApplies.map(({ p, key, apply }) => {
          const isPending = apply.status === 'pending';
          const isScheduled = apply.status === 'scheduled';
          return `
            <div style="background:#fff;border:1px solid #e9d5ff;border-radius:8px;padding:9px 12px">
              <div class="row">
                <b>${esc(p.alias || p.name)}</b>
                <span class="tag ${isScheduled ? 'green' : isPending ? 'orange' : 'gray'}">
                  ${isScheduled ? '🗓 王院长已排期' : isPending ? '⏳ 待王院长排期' : '未排期'}
                </span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:4px">
                申请人：<b>${uname(apply.applicant || p.leader)}</b> · 申报时间：${apply.submittedAt}
              </div>
              ${isScheduled ? `
                <div style="margin-top:4px;font-size:12.5px;color:#166534">
                  <b>排定会议：</b>${fmtAppt(apply.scheduledTime)}（${esc(apply.location || '分院会议室')}）
                </div>` : `
                <div style="margin-top:4px;font-size:12.5px;color:#b45309">
                  <b>期望时间：</b>${esc(apply.prefQuick || fmtAppt(apply.prefTime) || '尽快安排')}
                </div>`}
              <div style="margin-top:6px;text-align:right">
                <button class="btn sm ghost purple" onclick="go('project','${p.id}')">查看申报详情 →</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // 适用本所的公告
  const deptBulletins = (DB.bulletins || []).filter((b) => b.dept === '全院三个所' || b.dept.includes(dept));

  return `
    <div class="card" style="background:linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);border-left:4px solid #1f6feb">
      <div class="row">
        <b style="font-size:17px">🏢 ${dept} 生产调度看板</b>
        <span class="tag blue">所长：${uname(me)}</span>
      </div>
      <div class="muted" style="margin-top:4px">
        统揽本所项目进展、各级自审把关、技术质量闭环与报会状态
      </div>
    </div>

    <!-- 生产大盘指标卡 -->
    <div class="stat-grid" style="grid-template-columns:repeat(4, 1fr);margin-bottom:14px">
      <div class="stat-item">
        <div class="stat-num">${dProjects.length}</div>
        <div class="stat-lbl">本所总项目</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#0969da">${s1Count}</div>
        <div class="stat-lbl">前期初方案</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#8250df">${s2Count}</div>
        <div class="stat-lbl">报会推进中</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#1a7f37">${s3PlusCount + doneCount}</div>
        <div class="stat-lbl">评审/报批/结项</div>
      </div>
    </div>

    ${myReviewHtml}
    ${meetingHtml}

    <!-- 本所项目流水清单 -->
    <h2>📋 本所生产项目清单（${dProjects.length}）</h2>
    ${!dProjects.length ? '<div class="empty">本所暂无在编项目</div>' :
      dProjects.map((p) => {
        const curK = curStage(p);
        const curDef = STAGES[curK] || {};
        const isFin = finished(p);
        const latestV = latest(p);
        const resCount = (latestV.resolutions || []).length;
        const resDoneCount = (latestV.resolutions || []).filter((r) => r.resolved).length;
        return `
          <div class="card click" onclick="go('project','${p.id}')">
            <div class="row">
              <b style="font-size:15px">${esc(p.alias || p.name)}</b>
              <span class="tag ${isFin ? 'green' : 'blue'}">${isFin ? '已完成' : curDef.name}</span>
            </div>
            <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(p.name)}</div>
            <div class="row" style="margin-top:6px;font-size:12.5px">
              <span class="muted">负责人：<b>${uname(p.leader)}</b></span>
              <span class="muted">类别：<span class="tag">${p.category}</span></span>
            </div>
            ${resCount ? `
              <div style="margin-top:6px;padding:4px 8px;background:#f8fafc;border-radius:6px;font-size:12px;display:flex;justify-content:space-between;align-items:center">
                <span>📋 意见落实清单（第 ${latestV.no} 版）：</span>
                <span class="tag ${resDoneCount === resCount ? 'green' : 'orange'}">
                  ${resDoneCount === resCount ? `✔ 全部已销项（${resCount}条）` : `⏳ ${resDoneCount}/${resCount} 已销项`}
                </span>
              </div>` : ''}
            <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed #e1e4e8">
              <span class="muted" style="font-size:11.5px">最近动态：${(p.log[p.log.length - 1] || {}).text || '—'}</span>
              <span style="font-size:12px;color:#1f6feb;font-weight:500">进入项目 →</span>
            </div>
          </div>`;
      }).join('')}

    ${deptBulletins.length ? `
      <h2>📢 适用本所的院技术新规与自查要点</h2>
      <div class="card" style="border:1px solid #c8e1ff;background:#f8fbff">
        <div style="display:flex;flex-direction:column;gap:6px">
          ${deptBulletins.slice(0, 3).map((b) => `
            <div style="background:#fff;border:1px solid #d0e2ff;border-radius:6px;padding:8px 10px;cursor:pointer" onclick="bulletinDetailModal('${b.id}')">
              <div class="row">
                <span style="font-size:13px;font-weight:600;color:#1f2937">${esc(b.title)}</span>
                <span class="tag ${b.priority === 'high' ? 'red' : 'blue'}" style="font-size:10px">${b.tag}</span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:2px">${esc(b.summary)}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
  `;
}

function viewTodo() {
  let h = '';

  // 0. 院技术公告板速递卡片（让所有人第一眼看到院里发布的最新审查需求）
  const bulletins = DB.bulletins || [];
  const latestB = bulletins[0];
  if (latestB) {
    h += `
    <div class="card click" style="border:1.5px solid #c8e1ff;background:linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);margin-bottom:14px;padding:12px 14px" onclick="go('bulletin')">
      <div class="row">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:16px">📢</span>
          <b style="color:#0969da;font-size:14px">院技术公告板 · 审查新规速递</b>
          <span class="tag red" style="font-size:10px">NEW</span>
        </div>
        <span style="color:#1f6feb;font-size:12px;font-weight:500">全部 (${bulletins.length}) →</span>
      </div>
      <div style="margin-top:6px;font-size:13.5px;color:#1f2937;font-weight:600;line-height:1.4">
        📌 ${esc(latestB.title)}
      </div>
      <div class="muted" style="margin-top:3px;font-size:12px">
        ${esc(latestB.publisher)} · 适用【${esc(latestB.category)}】 · ${esc(latestB.summary.slice(0, 36))}...
      </div>
    </div>`;
  }

  // 1. 待我审查
  const tasks = myReviewTasks();
  h += `<h2>待我审查（${tasks.length}）</h2>`;
  h += tasks.length ? tasks.map(({ p, r, it }) => `
    <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row"><b>${esc(p.alias || p.name)}</b>${statusTag(it)}</div>
      <div class="muted" style="margin-top:4px">${p.dept || '规划一所'} · ${STAGES[r.stage].name} · ${uname(p.leader)} 送审</div>
      ${r.parallel ? `<span class="tag red">同时审查：${esc(r.reason)}</span>` : ''}
      <div style="margin-top:8px;color:#1f6feb;font-size:13px;font-weight:500">${it.status === 'pending' ? '👉 点此接收' + (r.paper ? '并约送册时间' : '') : '👉 点此填写审查意见'}</div>
    </div>`).join('') : '<div class="empty">暂无待审查事项 ☕</div>';

  // 2. 我参与的项目
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
      <div class="muted" style="margin-top:4px">${p.dept || '规划一所'} · 当前阶段：${curName}</div>
      ${applyBadge}
      ${appts.map((i) => `<div class="tag blue">📅 ${uname(i.uid)} 约 ${fmtAppt(i.appointment)} 送册</div>`).join('')}
      ${back.length ? `<div class="tag green">💬 本阶段已收到 ${back.length} 份意见</div>` : ''}
    </div>`;
  }).join('') : '<div class="empty">暂无</div>';
  return h;
}

// ===== 院技术公告板视图 =====
function viewTechnicalBulletin() {
  const isCE = U(me).role === '院总';
  const allBulletins = DB.bulletins || [];

  // 筛选过滤
  let list = allBulletins.filter((b) => {
    if (bulletinFilter.dept !== 'all') {
      if (b.dept !== '全院三个所' && !b.dept.includes(bulletinFilter.dept)) return false;
    }
    if (bulletinFilter.cat !== 'all') {
      if (b.category !== '全类型通用' && b.category !== bulletinFilter.cat) return false;
    }
    if (bulletinFilter.tag !== 'all') {
      if (b.tag !== bulletinFilter.tag) return false;
    }
    return true;
  });

  let h = `
  <div class="card" style="border:1.5px solid #1f6feb;background:linear-gradient(135deg, #f0f7ff 0%, #e6f0fd 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#0969da">📢 院技术公告板</b>
        <div class="muted" style="margin-top:2px;font-size:12px">全院各类别项目技术审查新需求 · 规范与共性通报 · 送审自查清单</div>
      </div>
      ${isCE ? `<button class="btn sm purple" onclick="publishBulletinModal()">➕ 发布新审查需求</button>` : ''}
    </div>
  </div>

  <!-- 三维筛选栏 -->
  <div style="margin:10px 0 6px">
    <div style="font-size:12px;color:#57606a;margin-bottom:4px">按所队筛选：</div>
    <div class="filter-bar">
      <span class="chip ${bulletinFilter.dept === 'all' ? 'on' : ''}" onclick="bulletinFilter.dept='all';render()">全部所队</span>
      ${DEPTS.map((d) => `<span class="chip ${bulletinFilter.dept === d ? 'on' : ''}" onclick="bulletinFilter.dept='${d}';render()">${d}</span>`).join('')}
    </div>

    <div style="font-size:12px;color:#57606a;margin:6px 0 4px">按项目类型筛选：</div>
    <div class="filter-bar">
      <span class="chip ${bulletinFilter.cat === 'all' ? 'on' : ''}" onclick="bulletinFilter.cat='all';render()">全部类型</span>
      <span class="chip ${bulletinFilter.cat === '全类型通用' ? 'on' : ''}" onclick="bulletinFilter.cat='全类型通用';render()">全类型通用</span>
      ${CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => `<span class="chip ${bulletinFilter.cat === c ? 'on' : ''}" onclick="bulletinFilter.cat='${c}';render()">${c}</span>`).join('')}
    </div>

    <div style="font-size:12px;color:#57606a;margin:6px 0 4px">按公告类型筛选：</div>
    <div class="filter-bar">
      <span class="chip ${bulletinFilter.tag === 'all' ? 'on' : ''}" onclick="bulletinFilter.tag='all';render()">全部公告</span>
      <span class="chip ${bulletinFilter.tag === '审查新需求' ? 'on' : ''}" onclick="bulletinFilter.tag='审查新需求';render()">审查新需求</span>
      <span class="chip ${bulletinFilter.tag === '共性问题通报' ? 'on' : ''}" onclick="bulletinFilter.tag='共性问题通报';render()">共性问题通报</span>
      <span class="chip ${bulletinFilter.tag === '送审清单' ? 'on' : ''}" onclick="bulletinFilter.tag='送审清单';render()">送审清单</span>
    </div>
  </div>

  <div class="row" style="margin:12px 2px 8px">
    <span style="font-size:13px;font-weight:600;color:#24292f">有效技术审查需求（${list.length} 条）</span>
    ${(bulletinFilter.dept !== 'all' || bulletinFilter.cat !== 'all' || bulletinFilter.tag !== 'all') ? `<span class="edit-link" onclick="bulletinFilter={dept:'all',cat:'all',tag:'all'};render()">清空筛选</span>` : ''}
  </div>`;

  if (!list.length) {
    h += `<div class="empty">暂无符合筛选条件的技术公告或审查新需求</div>`;
  } else {
    h += list.map((b) => {
      const tagColor = b.priority === 'high' ? 'red' : (b.tag === '审查新需求' ? 'blue' : 'purple');
      return `
      <div class="bulletin-card click" onclick="bulletinDetailModal('${b.id}')">
        <div class="row" style="margin-bottom:6px">
          <div>
            <span class="tag ${tagColor}">${b.tag || '审查新需求'}</span>
            <span class="tag blue">${esc(b.category)}</span>
            <span class="tag">${esc(b.dept)}</span>
            ${b.priority === 'high' ? '<span class="tag red">🚨 重点必查</span>' : ''}
          </div>
          <span class="muted" style="font-size:11px">${b.publishAt ? b.publishAt.split(' ')[0] : ''}</span>
        </div>

        <div style="font-size:14.5px;font-weight:700;color:#1f2937;line-height:1.4;margin-bottom:6px">
          ${esc(b.title)}
        </div>

        <div style="background:#f8faff;border-left:3px solid #1f6feb;padding:6px 10px;border-radius:0 6px 6px 0;font-size:12.5px;color:#374151;line-height:1.5;margin-bottom:8px">
          ${esc(b.summary)}
        </div>

        ${(b.checklist || []).length ? `
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#0969da;background:#eef6ff;padding:4px 8px;border-radius:6px;margin-bottom:8px">
            <span>✅ 包含送审前必查清单（${b.checklist.length} 项自查点）</span>
          </div>
        ` : ''}

        <div class="row" style="font-size:12px;color:#6b7280;padding-top:4px;border-top:1px dashed #e5e7eb">
          <span>发布人：${esc(b.publisher)}</span>
          <span style="color:#1f6feb;font-weight:500">查看需求详情 & 自查 →</span>
        </div>
      </div>`;
    }).join('');
  }

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

  const resHtml = (v) => {
    if (!v.resolutions || !v.resolutions.length) return '';
    const total = v.resolutions.length;
    const resolvedCount = v.resolutions.filter((r) => r.resolved).length;
    const allDone = resolvedCount === total;
    return `
      <div style="margin:10px 0;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;padding:10px">
        <div class="row">
          <b style="font-size:13px;color:#1e293b">📋 《审查意见修改落实对照清单》（第 ${v.no} 版）</b>
          <span class="tag ${allDone ? 'green' : 'orange'}">${allDone ? `✔ 全部已销项 (${total})` : `⏳ 销项进度 ${resolvedCount}/${total}`}</span>
        </div>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:6px">
          ${v.resolutions.map((r) => {
            const isReviewer = me === r.reviewerUid;
            const canResolve = isReviewer || ['院总', '所总', '所长'].includes(U(me).role) || isTeam(p);
            return `
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-size:12.5px">
                <div class="row">
                  <span><b>${uname(r.reviewerUid)}</b> <small class="muted">（${r.reviewerRole || '审查人'}）</small></span>
                  ${r.resolved ? `<span class="tag green">✔ 已销项 · ${uname(r.resolvedBy)}</span>` : `<span class="tag orange">⏳ 待核实销项</span>`}
                </div>
                <div style="color:#64748b;margin-top:3px">💬 意见：${esc(r.feedbackSummary)}</div>
                <div style="color:#0f172a;margin-top:3px;background:#f0fdf4;padding:4px 8px;border-radius:4px">
                  <b>落实说明：</b>${esc(r.reply)}
                </div>
                ${canResolve ? `
                  <div style="text-align:right;margin-top:6px">
                    <button class="btn sm ${r.resolved ? 'ghost' : 'green'}" onclick="toggleResolution('${p.id}', ${v.no}, '${r.id}')">
                      ${r.resolved ? '↩ 撤销销项' : '✔ 核实并销项'}
                    </button>
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  };

  const bodyHtml = (v, isOld) => `
    <div class="ver ${!isMulti ? 'single' : isOld ? 'old' : ''}">
      ${isMulti ? `<div class="row"><b>第 ${v.no} 版</b><span class="muted">🕒 ${v.at} · ${uname(v.by)}</span></div>` : ''}
      ${isMulti && v.note ? `<div class="note">📝 ${esc(v.note)}</div>` : ''}
      ${resHtml(v)}
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

  // 🎯 下一步核心行动（Next Best Action）
  let act = '';
  if (team) {
    const revertBtn = p.stageIdx > 0 ? `<button class="btn sm gray" onclick="revertStage(P('${p.id}'))">↩ 撤回上一阶段</button>` : '';
    if (finished(p)) {
      act = `<div class="card" style="border:1.5px solid #1a7f37;background:#f6fbf7">
        <div class="row">
          <b style="color:#1a7f37;font-size:15px">🎉 全部审查流程已圆满完成</b>
          <span class="tag green">已结项归档</span>
        </div>
        <div class="muted" style="margin-top:6px">所有审查意见均已销项，法定程序已完备。</div>
        <div style="margin-top:10px">${revertBtn}</div>
      </div>`;
    } else {
      let heroTitle = '';
      let heroBadge = '';
      let heroDesc = '';
      let heroAction = '';
      let altAction = '';

      if (def.type === 'meeting') {
        if (cur === 's2' || def.name.includes('技术审查会')) {
          if (!hasApply || sCur.apply.status === 'rejected') {
            heroTitle = '申请报会（直报王院长）';
            heroBadge = '<span class="tag purple">分院会节点</span>';
            heroDesc = '前期初方案自审成熟，请一键申请报会直报王院长排定审查会日程，免去纸质流转。';
            heroAction = `<button class="btn purple block" style="font-size:15px;padding:10px" onclick="applyMeetingModal('${p.id}','${cur}')">📅 申请报会（直报王院长排期）</button>`;
          } else if (isAppliedPending) {
            heroTitle = '等待王院长审批排期';
            heroBadge = '<span class="tag orange">审批排期中</span>';
            heroDesc = `已于 ${sCur.apply.submittedAt} 直报王院长，期望时间：<b>${esc(sCur.apply.prefQuick || fmtAppt(sCur.apply.prefTime) || '尽快安排')}</b>。`;
            heroAction = `<button class="btn ghost purple block" onclick="applyMeetingModal('${p.id}','${cur}')">👀 查看 / 补充报会申报材料</button>`;
          } else if (isAppliedScheduled) {
            heroTitle = '审查会已排期，待录入纪要';
            heroBadge = '<span class="tag green">已排期</span>';
            heroDesc = `王院长已排期于 <b>${fmtAppt(sCur.apply.scheduledTime)}</b>（${esc(sCur.apply.location || '分院会议室')}）。请按时参会并录入修改纪要。`;
            heroAction = `<button class="btn purple block" style="font-size:15px;padding:10px" onclick="meetingModal('${p.id}','${cur}')">📝 录入审查会纪要与落实情况</button>`;
            altAction = `<button class="btn green block" style="margin-top:6px" onclick="completeStage(P('${p.id}'))">✔ 会议要求已落实，推进至下一阶段 →</button>`;
          }
        } else {
          heroTitle = '录入会议信息与纪要';
          heroBadge = '<span class="tag blue">会议节点</span>';
          heroDesc = `请录入「${def.name}」的召开时间、地点与审查结论。`;
          heroAction = `<button class="btn block" onclick="meetingModal('${p.id}')">📝 录入会议信息</button>`;
          altAction = `<button class="btn green block" style="margin-top:6px" onclick="completeStage(P('${p.id}'))">✔ 完成本阶段会议，进入下一阶段 →</button>`;
        }
      } else {
        // review node
        const stageReviews = p.reviews.filter((r) => r.stage === cur);
        if (!stageReviews.length) {
          heroTitle = `发起「${def.forms ? def.forms[0] : '成果'}」送审`;
          heroBadge = '<span class="tag orange">待送审</span>';
          heroDesc = `当前处于「${def.name}」，请上传成果材料，选择校对/组长/所总等相关人员发起把关审查。`;
          heroAction = `<button class="btn block" style="font-size:15px;padding:10px" onclick="reviewModal('${p.id}')">📤 发起送审「${(def.forms && def.forms[0]) || '成果材料'}」</button>`;
        } else {
          const allDone = stageReviews.every((r) => r.items.every((it) => it.status === 'done'));
          const pendingItems = stageReviews.flatMap((r) => r.items.filter((it) => it.status !== 'done'));
          if (allDone) {
            heroTitle = `本阶段审查已全部完成！`;
            heroBadge = '<span class="tag green">审查全部通过</span>';
            heroDesc = `本阶段所有审查人员已完成意见反馈及销项核对，可推进至下一流程节点。`;
            heroAction = `<button class="btn green block" style="font-size:15px;padding:10px" onclick="completeStage(P('${p.id}'))">✔ 完成「${def.name}」，推进至下一阶段 →</button>`;
            altAction = `<button class="btn ghost sm" style="margin-top:8px" onclick="reviewModal('${p.id}')">＋ 追加送审其他人</button>`;
          } else {
            heroTitle = `等待审查人员反馈意见`;
            heroBadge = '<span class="tag blue">审查进行中</span>';
            heroDesc = `正在等待 <b>${pendingItems.map((i) => uname(i.uid)).join('、')}</b> 审查把关反馈。`;
            heroAction = `<button class="btn block" onclick="reviewModal('${p.id}')">📤 追加送审其他审查人</button>`;
            altAction = `<div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">
              ${def.optional ? `<button class="btn sm gray" onclick="completeStage(P('${p.id}'),true)">跳过（非必选）</button>` : ''}
              <button class="btn sm ghost green" onclick="completeStage(P('${p.id}'))">强制进入下一阶段</button>
            </div>`;
          }
        }
      }

      act = `<div class="card" style="border:1.5px solid #1f6feb;background:linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)">
        <div class="row">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:16px">🎯</span>
            <b style="font-size:14.5px;color:#0969da">下一步核心行动：${heroTitle}</b>
          </div>
          ${heroBadge}
        </div>
        <div class="muted" style="margin-top:6px;font-size:13px;line-height:1.4">${heroDesc}</div>
        <div style="margin-top:10px">${heroAction}</div>
        ${altAction ? `<div>${altAction}</div>` : ''}
        
        <!-- 次级功能收纳条 -->
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #d0d7de;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div style="display:flex;gap:6px">
            <button class="btn sm ghost purple" onclick="deanNoteModal('${p.id}')">✉️ 递小纸条给院长</button>
            <button class="btn sm ghost" onclick="versionModal('${p.id}')">＋ 上传新方案</button>
          </div>
          <div>${revertBtn}</div>
        </div>
      </div>`;
    }
  }

  // 院长直通车小纸条展示
  const notes = p.deanNotes || [];
  let notesHtml = '';
  if (notes.length) {
    notesHtml = `<div class="card" style="border:1.5px solid #8250df;background:#faf8ff">
      <div class="row">
        <b>✉️ 院长直通车记录（${notes.length}）</b>
        <button class="btn sm purple" onclick="deanNoteModal('${p.id}')">＋ 再递一张</button>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
        ${notes.slice().reverse().map((n) => `
          <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e9d5ff">
            <div class="row">
              <div>
                <b>${uname(n.by)}</b>
                <span class="muted" style="font-size:12px"> · ${n.at}</span>
                ${n.urgent ? '<span class="tag red">🚨 加急请示</span>' : ''}
              </div>
              <span class="tag ${n.status === 'replied' ? 'green' : 'orange'}">
                ${n.status === 'replied' ? '✅ 王院长已回复' : '⏳ 待王院长回复'}
              </span>
            </div>
            <div style="margin-top:4px;font-size:13.5px;color:#1e293b">📝 ${esc(n.text)}</div>
            ${n.photos && n.photos.length ? `<div style="margin-top:4px">${imgsHtml(n.photos)}</div>` : ''}
            ${n.status === 'replied' ? `
              <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d8b4fe;color:#166534;font-size:13px">
                <b>🗓 王院长已回复预约：</b>${fmtAppt(n.replyTime)}（${esc(n.replyLoc || '院长办公室')}）
                ${n.replyMsg ? `<div style="margin-top:2px;color:#334155"><b>批示：</b>${esc(n.replyMsg)}</div>` : ''}
              </div>` : ''}
            ${U(me).role === '院长' && n.status === 'pending' ? `
              <div style="margin-top:6px;text-align:right">
                <button class="btn sm purple" onclick="deanReplyNoteModal('${p.id}','${n.id}')">👉 回复预约沟通时间</button>
              </div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }

  const vs = p.versions;
  const otherMembers = p.members.filter((m) => m !== p.leader);

  return `<div class="card">
    <div class="row">
      <b style="font-size:17px">${esc(p.alias || p.name)}</b>
      <div>
        <span class="tag purple">${p.dept || '规划一所'}</span>
        <span class="tag">${p.category}</span>
      </div>
    </div>
    <div class="muted" style="margin-top:4px">${esc(p.name)}</div>
    ${imgsHtml(p.nameImgs)}
    <div class="muted" style="margin-top:6px">
      项目组：<b style="color:#b7791f">👑 ${uname(p.leader)}（负责人）</b>${otherMembers.length ? ' · ' + otherMembers.map(uname).join('、') : ''}
    </div>
    <div class="muted" style="margin-top:2px">公开：${p.visible.map(uname).join('、')}</div>
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid #f0f2f5;display:flex;justify-content:space-between;align-items:center">
      <span class="edit-link" onclick="deanNoteModal('${p.id}')" style="margin-left:0;color:#8250df">✉️ 院长直通车（递小纸条）</span>
      ${team ? `<span class="edit-link" onclick="editProjectModal('${p.id}')">✏️ 修改基本信息</span>` : ''}
    </div>
  </div>

  ${(() => {
    const pBulletins = (DB.bulletins || []).filter((b) => b.category === p.category || b.category === '全类型通用');
    if (!pBulletins.length) return '';
    return `
    <div class="card" style="border:1.5px solid #c8e1ff;background:#f8fbff;padding:12px 14px">
      <div class="row">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:15px">💡</span>
          <b style="font-size:13.5px;color:#0969da">适用本项目【${p.category}】的院审查新规（${pBulletins.length}条）</b>
        </div>
        <span class="edit-link" onclick="go('bulletin')" style="margin-left:0;font-size:12px">公告板 →</span>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
        ${pBulletins.map((b) => `
          <div style="background:#fff;border:1px solid #d0e2ff;border-radius:6px;padding:8px 10px;cursor:pointer" onclick="bulletinDetailModal('${b.id}')">
            <div class="row">
              <span style="font-size:13px;font-weight:600;color:#1f2937">${esc(b.title)}</span>
              <span class="tag ${b.priority === 'high' ? 'red' : 'blue'}" style="font-size:10px">${b.tag}</span>
            </div>
            <div class="muted" style="font-size:12px;margin-top:3px">${esc(b.summary)}</div>
            ${(b.checklist || []).length ? `<div style="margin-top:4px;font-size:11.5px;color:#0969da">✅ 含 ${b.checklist.length} 项送审自查要点（点击核对）</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  })()}

  ${deanCard}
  ${act}
  ${notesHtml}

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
