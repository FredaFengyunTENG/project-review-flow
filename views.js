// ===== 页面视图 =====

let memberState = []; // 当前编辑中的项目组成员列表 [uid1, uid2...] 第一位为负责人

function render() {
  const todoBtn = $('#tabbar button[data-go="todo"]');
  if (todoBtn) {
    if (U(me).role === '院长') todoBtn.textContent = '👑 院长看板';
    else if (U(me).role === '院总') todoBtn.textContent = '🏛 院总看板';
    else todoBtn.textContent = '📋 待办';
  }
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === route.name));
  const v = $('#view');
  lastUpl = null;
  if (route.name === 'todo') {
    if (U(me).role === '院长') v.innerHTML = viewDeanBoard();
    else if (U(me).role === '院总') v.innerHTML = viewChiefEngineerBoard();
    else v.innerHTML = viewTodo();
  }
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

  // 1. 待办事件一：报会技术审查会看板（累计开会机制）
  h += `<div class="row" style="margin:16px 0 8px">
    <b style="font-size:15px;color:#1e293b">⚡ 分院技术审查会 · 报会看板（${applies.length}）</b>
    ${applies.length >= 2 ? '<span class="tag orange" style="font-weight:600">已达集中开会建议量</span>' : ''}
  </div>`;

  if (applies.length >= 2) {
    h += `<div class="card" style="border:1.5px solid #f59e0b;background:#fffbeb;padding:10px 12px">
      <div style="font-weight:600;font-size:13.5px;color:#b45309">
        💡 报会数量已达集中开会标准（已累计 ${applies.length} 个项目申请上会）
      </div>
      <div style="font-size:12.5px;color:#92400e;margin-top:3px;line-height:1.4">
        建议统一排定时间组织集中审查会，一并通知相关所队参会人员，提高领导会商效率。
      </div>
      <button class="btn purple block" style="margin-top:8px" onclick="deanBatchScheduleModal()">🗓 一键合并排期开会（${applies.length}个项目合并上会）</button>
    </div>`;
  } else if (applies.length === 1) {
    h += `<div class="card" style="background:#f8fafc;padding:8px 12px;font-size:12.5px;color:#475569">
      当前已累计 1 项报会申请（通常累计 2~3 项集中开会，亦可随时单独排期开会）。
    </div>`;
  }

  h += applies.length ? applies.map(({ p, key, apply }) => `
    <div class="card" style="border:1px solid #d8b4fe;background:#faf8ff">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        <span class="tag purple">${p.dept || '规划一所'}</span>
      </div>
      <div class="muted" style="margin-top:3px">
        申请人：<b>${uname(apply.applicant || p.leader)}</b> · 提交时间：${apply.submittedAt || ''}
      </div>
      <div style="margin-top:4px;font-size:13px">
        <b>期望时间：</b><span style="color:#7c3aed;font-weight:600">${esc(apply.prefQuick || fmtAppt(apply.prefTime))}</span>
      </div>
      ${apply.materials && apply.materials.length ? `<div style="margin-top:2px;font-size:12px;color:#475569">材料就绪：${apply.materials.map((m) => `<span class="tag">${esc(m)}</span>`).join('')}</div>` : ''}
      ${apply.note ? `<div style="margin-top:3px;font-size:12.5px;color:#334155;background:#fff;padding:5px 8px;border-radius:6px;border:1px solid #e9d5ff">自审说明：${esc(apply.note)}</div>` : ''}
      <div style="margin-top:8px;text-align:right">
        <button class="btn sm purple" onclick="deanScheduleModal('${p.id}','${key}')">🗓 审批并单独排期</button>
      </div>
    </div>`).join('') : '<div class="empty">暂无待开会的报会申请 ☕</div>';

  // 2. 待办事件二：院长直通车（小纸条）待办
  h += `<div class="row" style="margin:20px 0 8px">
    <b style="font-size:15px;color:#1e293b">✉️ 院长直通车 · 小纸条待办（${notes.length}）</b>
    <span class="muted" style="font-size:12px">项目组特殊急件请示</span>
  </div>`;

  h += notes.length ? notes.map(({ p, note }) => `
    <div class="card click" style="border:1.5px solid ${note.urgent ? '#fca5a5' : '#8250df'};background:#fff" onclick="deanReplyNoteModal('${p.id}','${note.id}')">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        <span class="tag ${note.urgent ? 'red' : 'purple'}">${note.urgent ? '🚨 加急请示' : '✉️ 小纸条'}</span>
      </div>
      <div class="muted" style="margin-top:3px">
        来自：<b>${uname(note.by)}</b>（${p.dept || '规划一所'}） · 递送于 ${note.at}
      </div>
      <div style="margin-top:6px;font-size:13.5px;color:#1e293b;background:#faf8ff;padding:8px 10px;border-radius:6px;border:1px solid #e9d5ff">
        📝 ${esc(note.text)}
      </div>
      ${note.photos && note.photos.length ? `<div style="margin-top:4px">${imgsHtml(note.photos)}</div>` : ''}
      <div style="margin-top:8px;color:#8250df;font-size:13px;font-weight:600">👉 点此回复预约沟通时间（啥时候来）</div>
    </div>`).join('') : '<div class="empty">暂无待回复直通车小纸条 ☕</div>';

  // 3. 常规待我审查（如果有）
  if (myTasks.length) {
    h += `<h2>待我审查（${myTasks.length}）</h2>` + myTasks.map(({ p, r, it }) => `
      <div class="card click" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
        <div class="row"><b>${esc(p.alias || p.name)}</b>${statusTag(it)}</div>
        <div class="muted" style="margin-top:4px">${STAGES[r.stage].name} · ${uname(p.leader)} 送审</div>
        ${r.parallel ? `<span class="tag red">同时审查：${esc(r.reason)}</span>` : ''}
      </div>`).join('');
  }

  // 4. 全部项目快捷查看
  h += `<div style="margin-top:20px;text-align:center">
    <button class="btn gray" onclick="go('projects')">📁 查看分院全部规划项目列表 (${totalProjects})</button>
  </div>`;

  return h;
}

// ===== 李院总专属看板 =====
function viewChiefEngineerBoard() {
  const allProjects = DB.projects.filter((p) => canSee(p, me));

  const curDept = ceFilter.dept || 'all';
  const curCat = ceFilter.cat || 'all';

  const filterProjects = allProjects.filter((p) => {
    if (curDept !== 'all' && (p.dept || '规划一所') !== curDept) return false;
    if (curCat !== 'all' && p.category !== curCat) return false;
    return true;
  });

  // 院总审查任务分层
  // Layer 1: 🚨 待我紧急审查 (加急/同时审查)
  const urgentTasks = [];
  // Layer 2: ⏳ 待我常规把关 (逐级已到院总)
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

  // Layer 3: 👀 各所自审中（即将送审院总·下周工作预判）
  const upcomingProjects = filterProjects.filter((p) => {
    const cur = curStage(p);
    if (cur !== 's1' && cur !== 's3') return false;
    const hasMine = p.reviews.some((r) => r.stage === cur && r.items.some((i) => i.uid === me));
    return !hasMine && !finished(p);
  });

  // Layer 4: ✅ 院总已审完（各所落实跟踪中）
  const doneProjects = filterProjects.filter((p) => {
    return p.reviews.some((r) => r.items.some((i) => i.uid === me && i.status === 'done')) && !finished(p);
  });

  // 普适性技术问题收集板
  const rawIssues = DB.commonIssues || [];
  const issues = rawIssues.filter((iss) => {
    if (curCat !== 'all' && iss.category !== curCat) return false;
    if (curDept !== 'all' && iss.dept !== '全院' && iss.dept !== curDept) return false;
    return true;
  });

  let h = `
  <div class="card" style="border:1.5px solid #1f6feb;background:linear-gradient(135deg, #f0f7ff 0%, #e6f0fd 100%)">
    <div class="row">
      <div>
        <b style="font-size:16px;color:#1e40af">🏛 李院总 · 全院技术审查总看板</b>
        <div class="muted" style="margin-top:2px;font-size:12px">全院规划技术最高把关 · 清晰分类分层 · 普适性问题全院统一</div>
      </div>
      <span class="tag blue" style="font-size:12px;font-weight:600">把关 ${allProjects.length} 项</span>
    </div>

    <div class="stat-grid" style="margin-top:10px">
      <div class="stat-item">
        <div class="stat-num" style="color:#cf222e">${urgentTasks.length}</div>
        <div class="stat-lbl">🚨 紧急加急待审</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#0969da">${normalTasks.length}</div>
        <div class="stat-lbl">⏳ 常规待审项目</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color:#7c3aed">${issues.length}</div>
        <div class="stat-lbl">💡 普适性问题提炼</div>
      </div>
    </div>
  </div>`;

  // 多维度筛选条（三个所队 + 类别）
  h += `<div class="card" style="padding:10px 12px;margin-bottom:12px">
    <div style="font-size:12px;color:#57606a;margin-bottom:4px">按所队筛选（我们有三个所）：</div>
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

  // Layer 1: 🚨 待我紧急审查 (加急/同时审查)
  h += `<div class="row" style="margin:16px 0 6px">
    <b style="font-size:15px;color:#cf222e">🚨 第一层：待我加急审查（${urgentTasks.length}）</b>
    <span class="tag red">优先保障</span>
  </div>`;
  h += urgentTasks.length ? urgentTasks.map(({ p, r, it }) => `
    <div class="card click" style="border:1.5px solid #fca5a5;background:#fff5f5" onclick="${it.status === 'pending' ? `acceptModal('${p.id}','${r.id}')` : `feedbackModal('${p.id}','${r.id}')`}">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        <span class="tag red">同时审查·加急</span>
      </div>
      <div class="muted" style="margin-top:2px">${p.dept || '规划一所'} · ${p.category}</div>
      <div style="margin-top:4px;font-size:13px;color:#cf222e;font-weight:500">
        ⚡ 加急原因：${esc(r.reason || '紧急审议')}
      </div>
      <div style="margin-top:8px;color:#1f6feb;font-size:13px;font-weight:600">👉 点此填写院总技术把关意见</div>
    </div>`).join('') : '<div class="card empty" style="padding:16px 0;margin-bottom:8px">暂无紧急加急待办 ☕</div>';

  // Layer 2: ⏳ 待我常规把关 (逐级已到院总)
  h += `<div class="row" style="margin:16px 0 6px">
    <b style="font-size:15px;color:#0969da">⏳ 第二层：待我常规把关（${normalTasks.length}）</b>
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
    </div>`).join('') : '<div class="card empty" style="padding:16px 0;margin-bottom:8px">暂无常规待审项目 ☕</div>';

  // Layer 3: 👀 各所自审中（即将送审院总·工作量预判）
  h += `<div class="row" style="margin:16px 0 6px">
    <b style="font-size:15px;color:#475569">👀 第三层：各所自审中·下周工作预判（${upcomingProjects.length}）</b>
    <span class="tag gray">即将送院总</span>
  </div>`;
  if (upcomingProjects.length) {
    h += `<div class="card" style="padding:8px 12px">
      <div class="muted" style="font-size:12px;margin-bottom:6px">以下项目目前所内组长/所总正在审理中，预计近期将流转至院总把关：</div>
      ${upcomingProjects.map((p) => `
        <div style="padding:6px 0;border-bottom:1px dashed #e2e8f0" class="row">
          <div>
            <b>${esc(p.alias || p.name)}</b>
            <span class="muted" style="font-size:12px">（${p.dept || '规划一所'} · ${STAGES[curStage(p)] ? STAGES[curStage(p)].name : ''}）</span>
          </div>
          <span class="edit-link" onclick="go('project','${p.id}')">提前预看</span>
        </div>`).join('')}
    </div>`;
  } else {
    h += '<div class="card empty" style="padding:12px 0;margin-bottom:8px">暂无所内自审预报</div>';
  }

  // 重点板块：💡 普适性技术问题收集板
  h += `
  <div class="row" style="margin:24px 0 8px">
    <div>
      <b style="font-size:15.5px;color:#7c3aed">💡 普适性技术问题收集板（${issues.length}）</b>
      <div class="muted" style="font-size:12px;margin-top:2px">从院总审查批注与意见中自动沉淀 · 可修改后一键发送三个所</div>
    </div>
    <button class="btn sm purple" onclick="newIssueModal()">＋ 新增注意点</button>
  </div>`;

  h += issues.length ? issues.map((iss) => `
    <div class="issue-card">
      <div class="row">
        <div>
          <span class="tag blue">${esc(iss.category)}</span>
          <span class="tag">${esc(iss.dept)}</span>
          <span class="tag ${iss.broadcasted ? 'green' : 'orange'}">${iss.broadcasted ? '📢 已发全院三个所' : '⏳ 待发全院'}</span>
        </div>
        <span class="muted" style="font-size:11px">${iss.createdAt}</span>
      </div>
      <div class="muted" style="font-size:12px;margin-top:4px">来源：${esc(iss.pname)}</div>
      
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
    </div>`).join('') : '<div class="empty">暂无收集的普适性技术问题</div>';

  return h;
}

function setCeFilter(k, v) {
  ceFilter[k] = v;
  render();
}

function viewTodo() {
  let h = '';

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
          <button class="btn ghost purple" onclick="deanNoteModal('${p.id}')">✉️ 递小纸条给院长</button>
          <button class="btn green" onclick="completeStage(P('${p.id}'))">✔ 本阶段完成</button>
          ${def.optional ? `<button class="btn gray" onclick="completeStage(P('${p.id}'),true)">跳过（非必选）</button>` : ''}
          ${revert}
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
