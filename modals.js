// ===== 弹窗组件（少打字、多点选、零负担）=====
const btns = (okFn, okText) => `<div class="sheet-actions"><button class="btn block" onclick="${okFn}">${okText}</button><button class="btn text neutral block" onclick="closeModal()">取消</button></div>`;
const closeBtn = (label = '关闭', fn = 'closeModal()') => `<div class="sheet-actions"><button class="btn gray block" onclick="${fn}">${label}</button></div>`;

// ---- 操作记录 ----
function historyModal(pid) {
  const p = P(pid);
  openModal(`<h3>操作记录</h3>
    <div class="muted sheet-sub">${esc(p.alias || p.name)}</div>
    <div class="scroll-box">
      ${p.log.slice().reverse().map((l) => `<div class="log ${l.edit ? 'edit' : ''}"><b>${l.t}</b>${esc(l.text)}</div>`).join('')}
    </div>
    ${closeBtn()}`);
}

// ---- 送审（全点选）----
function reviewModal(pid, targetStageKey) {
  const p = P(pid), cur = targetStageKey || curStage(p), def = stageMeta(p, cur);
  const isAdvance = targetStageKey && targetStageKey !== curStage(p);
  const forms = def.forms || ['成果材料'];
  const pool = reviewerPool(p);
  const people = pool.map((u) => {
    const role = U(u).role;
    const isTech = role === '组长' || role === '所总';
    const tag = isTech ? `${role}·审查校对` : role;
    return [u, `${uname(u)}·${tag}`];
  });
  const next = suggestNext(p);
  const quickReasons = ['急赶上会', '局里急调', '节点急件', '其他'];

  openModal(`<div class="sheet-head"><h3>${isAdvance ? icon('zap') + '提前送审' : '送审'} · ${esc(def.name)}</h3></div>
    ${isAdvance ? `<div class="mb-3"><span class="tag parallel">${icon('zap', 'i-sm')}并联推进：在等开会，提前把关下一阶段材料</span></div>` : ''}
    <label class="f">成果形式 <span class="faint">${def.dual ? '优化调整 + 新编控规两套都要送' : '可多选'}</span></label>
    ${chips('m_form', forms.map((f) => [f, f]), def.dual ? forms.filter((f) => f !== '汇报演示稿') : [forms[0]])}

    <label class="f">提交方式 <span class="faint">可都选</span></label>
    ${chips('m_paper', [['0', '电子档'], ['1', '纸质文件']], cur === 's1' ? ['0'] : ['0', '1'])}

    <label class="f">审查方式</label>
    ${chips('m_mode', [['seq', '逐级审查'], ['par', '同时审查']], ['seq'], true)}

    <label class="f" id="m_whoLabel">送给谁</label>
    <div id="m_whoBox">${chips('m_who', people, next ? [next] : [], true)}</div>
    <div class="hint">${icon('info', 'i-sm')}<span>组长/所总负责成果审查与校对；送审后同步知晓所长，所长可自主选择一键阅知或亲自把关。</span></div>

    <div id="m_reasonBox" class="hidden">
      <label class="f">同时审查原因（点选）</label>
      ${chips('m_rchip', quickReasons.map((r) => [r, r]), ['急赶上会'], true)}
      <input type="text" id="m_reason" class="input-gap" placeholder="选填补充说明">
    </div>
    ${btns(`doReview('${pid}', '${targetStageKey || ''}')`, '发送送审')}`);

  $('#m_mode')?.addEventListener('change', () => {
    const par = picked('#m_mode')[0] === 'par';
    $('#m_whoBox').innerHTML = chips('m_who', people, picked('#m_who'), !par);
    $('#m_whoLabel').textContent = par ? '送给谁（可多选）' : '送给谁';
    $('#m_reasonBox').classList.toggle('hidden', !par);
  });
}

function doReview(pid, targetStageKey) {
  const parallel = picked('#m_mode')[0] === 'par';
  const reviewers = picked('#m_who');
  if (!reviewers.length) return toast('请选择审查人');
  const formsPicked = picked('#m_form');
  if (!formsPicked.length) return toast('请选择成果形式');
  const ways = picked('#m_paper');
  if (!ways.length) return toast('请选择电子档或纸质文件');
  const reason = parallel ? ($('#m_reason')?.value.trim() || picked('#m_rchip')[0] || '急赶上会') : '';
  submitReview(P(pid), {
    stage: targetStageKey || undefined,
    form: formsPicked.join('、'),
    paper: ways.includes('1'),
    digital: ways.includes('0'),
    parallel,
    reason,
    reviewers,
  });
}

function findItem(pid, rid) {
  const p = P(pid), r = p.reviews.find((x) => x.id === rid);
  return { p, r, it: r.items.find((i) => i.uid === me) };
}
function quickTime(addDays, hour, min = 0) {
  const d = new Date(); d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(min)}`;
}

// ---- 接收 + 约送册时间 ----
function acceptModal(pid, rid) {
  const { p, r } = findItem(pid, rid);
  const q = (label, v) => `<button class="btn ghost" onclick="doAccept('${pid}','${rid}','${v}')">${label}</button>`;
  openModal(`<h3>${uname(p.leader)} 请你审查</h3>
    <div class="card flat">
      <b>${esc(p.alias || p.name)}</b>
      <div class="muted mt-1">${esc(stageMeta(p, r.stage).name)} · ${esc(r.form)} · ${wayText(r)}</div>
      ${r.parallel ? `<div class="mt-2"><span class="tag danger">同时审查：${esc(r.reason)}</span></div>` : ''}
    </div>
    ${r.paper ? `
      <label class="f">什么时候方便送册过来？点一下即可</label>
      <div class="grid-2">
        ${q('随时可送', 'any')}
        ${q('今天 15:00', quickTime(0, 15))}
        ${q('明天 09:00', quickTime(1, 9))}
        ${q('明天 14:00', quickTime(1, 14))}
      </div>
      <label class="f">或自选时间</label>
      <input type="datetime-local" id="m_appt" onchange="doAccept('${pid}','${rid}',this.value)">
      <div class="sheet-actions"><button class="btn text neutral block" onclick="closeModal()">稍后</button></div>
    ` : `<div class="sheet-actions">
      <button class="btn block" onclick="doAccept('${pid}','${rid}','');feedbackModal('${pid}','${rid}')">已收到，去填意见</button>
      <button class="btn text neutral block" onclick="closeModal()">稍后</button>
    </div>`}`);
}
function doAccept(pid, rid, appt) { const { p, r, it } = findItem(pid, rid); acceptReview(p, r, it, appt); }

// ---- 审查意见（点按为主，少打字）----
let fbCount = { dataErr: 0, textErr: 0 };
function bump(k, d) { fbCount[k] = Math.max(0, fbCount[k] + d); $('#c_' + k).textContent = fbCount[k]; }

function feedbackModal(pid, rid) {
  const { p, r, it } = findItem(pid, rid);
  const old = it.feedback && !it.feedback.quick ? it.feedback : {};
  fbCount = { dataErr: old.dataErr || 0, textErr: old.textErr || 0 };
  const isYuanZong = U(me).role === '院总';
  const subReviewers = subordinateReviewers(p);
  const quickTags = ['指标需核对', '红线退让需核', '用地性质表述', '图面表达修改'];

  const counter = (k, label) => `<div class="counter-row"><span>${label}</span><div class="counter">
    <button type="button" onclick="bump('${k}',-1)" aria-label="减少">${icon('minus', 'i-sm')}</button><b id="c_${k}">${fbCount[k]}</b><button type="button" onclick="bump('${k}',1)" aria-label="增加">${icon('plus', 'i-sm')}</button></div></div>`;

  openModal(`<h3>审查意见 · ${esc(p.alias || p.name)}</h3>
    <div class="grid-2">
      <button class="btn ghost" onclick="doFeedback('${pid}','${rid}','已阅，无意见')">${icon('check')}已阅，无意见</button>
      <button class="btn ghost" onclick="doFeedback('${pid}','${rid}','意见见纸质批注')">${icon('check')}意见见纸质批注</button>
    </div>

    <div class="faint center mt-4 mb-3">或点选 / 拍批注页</div>
    ${chips('f_qtags', quickTags.map((t) => [t, t]), [])}
    ${counter('dataErr', '数据错误（处）')}
    ${counter('textErr', '文字错误（处）')}
    <label class="f">批注照片 / 截图（选填）</label>
    ${uploader('f_photos', old.photos || [])}
    <label class="f">补充说明（选填）</label>
    <input type="text" id="f_key" value="${esc(old.key || '')}" placeholder="选填，一句话说明">

    ${isYuanZong && subReviewers.length ? `
      <label class="f">顺便提醒所内审查人留意（选填）</label>
      ${chips('f_notify', subReviewers.map((u) => [u, uname(u)]))}` : ''}

    ${isYuanZong ? `
      <label class="check-line">
        <input type="checkbox" id="f_to_common"> 同步记入共性问题库
      </label>` : ''}

    ${btns(`doFeedback('${pid}','${rid}')`, '提交意见')}`);
}

function doFeedback(pid, rid, quick = '') {
  const { p, r, it } = findItem(pid, rid);
  const qPicked = picked('#f_qtags');
  const typed = $('#f_key')?.value.trim() || '';
  const mergedKey = [qPicked.join('、'), typed].filter(Boolean).join('；');

  const fb = quick ? { quick } : {
    quick: '', ...fbCount, key: mergedKey, other: '', photos: [...(UPL.f_photos || [])],
  };
  if (!quick && !fb.dataErr && !fb.textErr && !fb.key && !fb.photos.length) {
    return toast('请点选一项，或直接点「已阅，无意见」');
  }

  let commonIssueData = null;
  if ($('#f_to_common') && $('#f_to_common').checked) {
    const title = mergedKey || '审查共性注意点';
    commonIssueData = {
      id: 'iss' + Date.now(),
      pid: p.id,
      pname: p.alias || p.name,
      category: p.category,
      dept: p.dept || '规划一所',
      createdAt: now(),
      by: me,
      title: title.slice(0, 26),
      problem: mergedKey || '详见审查批注',
      guide: '请各所在同类项目自审时留意核对。',
      broadcasted: false,
      broadcastScope: [],
      broadcastAt: '',
    };
  }

  submitFeedback(p, r, it, fb, $('#f_notify') ? picked('#f_notify') : [], '', commonIssueData);
}

// ---- 院总提醒所内审查人员 ----
function notifyModal(pid) {
  const p = P(pid);
  const subs = subordinateReviewers(p);
  if (!subs.length) return toast('暂无所内审查人员');
  openModal(`<h3>提醒所内审查人员</h3>
    <label class="f">选择人员</label>
    ${chips('n_who', subs.map((u) => [u, `${uname(u)}·${U(u).role}`]), subs)}
    <input type="text" id="n_msg" class="input-gap" placeholder="选填一句话提醒">
    ${btns(`doNotify('${pid}')`, '发送提醒')}`);
}
function doNotify(pid) {
  const who = picked('#n_who');
  if (!who.length) return toast('请选择人员');
  closeModal(); notifyOthers(P(pid), who, $('#n_msg')?.value.trim() || '');
}

// 快捷时间按钮
const quickTimeBtn = (target, label, v) => `<button type="button" class="btn ghost sm" onclick="$('#${target}').value='${v}'">${label}</button>`;

// ---- 王院长排期开会（极简点选：定时间 + 定地点 + 通知参会人）----
function deanScheduleModal(pid, key = 's2') {
  const p = P(pid);
  const s = st(p, key);
  const ap = s.apply || {};
  const people = projectPeople(p).map((u) => [u, uname(u)]);
  const defaultAttendees = uniq([me, 'u2', 'u3', 'u5', p.leader, ...(p.members || [])]).filter((u) => projectPeople(p).includes(u));
  const rooms = [['三楼大会议室', '三楼大会议室'], ['二楼研讨室', '二楼研讨室'], ['五楼多功能厅', '五楼多功能厅'], ['视频会议', '视频会议']];

  openModal(`<h3>排定会议 · ${esc(p.alias || p.name)}</h3>
    <label class="f">会议时间</label>
    <div class="grid-2 mb-2">
      ${quickTimeBtn('d_time', '明天 09:30', quickTime(1, 9, 30))}
      ${quickTimeBtn('d_time', '明天 14:30', quickTime(1, 14, 30))}
      ${quickTimeBtn('d_time', '后天 09:30', quickTime(2, 9, 30))}
      ${quickTimeBtn('d_time', '后天 14:30', quickTime(2, 14, 30))}
    </div>
    <input type="datetime-local" id="d_time" value="${ap.scheduledTime || quickTime(1, 9, 30)}">

    <label class="f">会议地点</label>
    ${chips('d_loc', rooms, [ap.location || '三楼大会议室'], true)}

    <label class="f">参会人员</label>
    ${chips('d_att', people, ap.attendees || defaultAttendees)}

    ${btns(`doDeanSchedule('${pid}','${key}')`, `${icon('check')}确定开会并通知参会人`)}`);
}

function doDeanSchedule(pid, key) {
  const time = $('#d_time').value;
  const location = picked('#d_loc')[0] || '三楼大会议室';
  const attendees = picked('#d_att');
  if (!time) return toast('请选择时间');
  deanSchedule(P(pid), { time, location, attendees }, key);
}

// ---- 王院长合并排期集中开会 ----
function deanBatchScheduleModal() {
  const applies = deanPendingApplies();
  if (!applies.length) return toast('暂无报会项目');
  const allAttendees = uniq([me, 'u2', 'u3', 'u4', 'u5', 'u6', ...applies.flatMap((a) => [a.p.leader, ...(a.p.members || [])])]);
  const people = USERS.filter((u) => allAttendees.includes(u.id)).map((u) => [u.id, uname(u)]);
  const rooms = [['三楼大会议室', '三楼大会议室'], ['二楼研讨室', '二楼研讨室'], ['五楼多功能厅', '五楼多功能厅'], ['视频会议', '视频会议']];

  openModal(`<h3>合并排定技术审查会（${applies.length} 项）</h3>
    <div class="vstack">
      ${applies.map(({ p }) => `
        <label class="check-item">
          <input type="checkbox" name="bs_pids" value="${p.id}" checked>
          <b>${esc(p.alias || p.name)}</b>
          <span class="muted ml-auto">${uname(p.leader)}</span>
        </label>`).join('')}
    </div>

    <label class="f">会议时间</label>
    <div class="grid-2 mb-2">
      ${quickTimeBtn('bs_time', '明天 09:30', quickTime(1, 9, 30))}
      ${quickTimeBtn('bs_time', '明天 14:30', quickTime(1, 14, 30))}
    </div>
    <input type="datetime-local" id="bs_time" value="${quickTime(1, 9, 30)}">

    <label class="f">会议地点</label>
    ${chips('bs_loc', rooms, ['三楼大会议室'], true)}

    <label class="f">参会人员</label>
    ${chips('bs_att', people, allAttendees)}

    ${btns('doDeanBatchSchedule()', `${icon('check')}确定排期并通知全员`)}`);
}

function doDeanBatchSchedule() {
  const pids = $$('input[name="bs_pids"]:checked').map((x) => x.value);
  if (!pids.length) return toast('请至少勾选一项');
  deanBatchSchedule(pids, {
    time: $('#bs_time').value,
    location: picked('#bs_loc')[0] || '三楼大会议室',
    attendees: picked('#bs_att'),
  });
}

// ---- 会议记录（点选结论 + 拍纪要，不强求写长文）----
function meetingModal(pid, key) {
  const p = P(pid); key = key || curStage(p);
  const meta = stageMeta(p, key);
  const s = p.stages[key] || {};
  const ap = s.apply || {};
  const defaultLoc = key === 's2' ? '三楼大会议室' : key === 's7' ? '市政府会议室' : '市资源规划局';
  const locs = ['三楼大会议室', '二楼研讨室', '市资源规划局', '市政府会议室'];
  const results = ['原则通过', '修改后通过', '局部调整指标', '补充材料再议'];
  const m = s.meeting || {
    time: ap.scheduledTime || quickTime(0, 9, 30),
    location: ap.location || defaultLoc,
    attendees: ap.attendees || [p.leader],
    opinion: '原则通过',
    photos: [],
  };
  const people = projectPeople(p).map((u) => [u, uname(u)]);
  const curRes = results.includes(m.opinion) ? [m.opinion] : [];

  openModal(`<h3>记录 · ${esc(meta.name)}</h3>
    <label class="f">会议结论（点选）</label>
    ${chips('g_res', results.map((r) => [r, r]), curRes.length ? curRes : ['原则通过'], true)}

    <label class="f">上会时间</label>
    <input type="datetime-local" id="g_time" value="${m.time || quickTime(0, 9, 30)}">

    <label class="f">会议地点</label>
    ${chips('g_loc', locs.map((l) => [l, l]), [locs.includes(m.location) ? m.location : defaultLoc], true)}

    <label class="f">参会人员</label>
    ${chips('g_att', people, m.attendees && m.attendees.length ? m.attendees : [p.leader])}

    <label class="f">纪要照片 / 截图（选填）</label>
    ${uploader('g_photos', m.photos || [])}

    <label class="f">补充一句话（选填）</label>
    <input type="text" id="g_note" value="${esc(!results.includes(m.opinion) ? (m.opinion || '') : (m.implement || ''))}" placeholder="选填">

    ${btns(`doMeeting('${pid}','${key}')`, '保存')}`);
}

// ---- 不公示：理由点选，补充说明点开才显示 ----
function noPubModal(pid) {
  const p = P(pid), def = stageMeta(p, curStage(p));
  const reasons = NO_PUB_REASONS[p.category] || NO_PUB_REASONS.default;
  openModal(`<div class="sheet-head"><h3>不公示 · ${esc(def.name)}</h3></div>
    <label class="f">理由</label>
    ${chips('np_r', reasons.map((r) => [r, r]), [reasons[0]], true)}
    <div id="np_more" class="hidden"><input type="text" id="np_note" class="input-gap" placeholder="选填"></div>
    <button type="button" class="btn sm text" onclick="$('#np_more').classList.remove('hidden');this.remove()">${icon('plus', 'i-sm')}补充说明</button>
    <div class="sheet-actions">
      <button class="btn block" onclick="noPublish(P('${pid}'), picked('#np_r')[0] || '其他', $('#np_note')?.value.trim() || '')">确认不公示</button>
      <button class="btn text neutral block" onclick="closeModal()">取消</button>
    </div>`);
}

function doMeeting(pid, key) {
  const res = picked('#g_res')[0] || '';
  const extra = $('#g_note')?.value.trim() || '';
  saveMeeting(P(pid), {
    time: $('#g_time').value,
    location: picked('#g_loc')[0] || '',
    attendees: picked('#g_att'),
    opinion: res,
    implement: extra,
    photos: [...(UPL.g_photos || [])],
  }, key);
}

// ---- 上传新版方案（只传用地图+指标表，点选原因）----
function versionModal(pid) {
  const p = P(pid), v = latest(p);
  const reasons = ['按审查意见修改', '调整指标表', '优化用地图', '会后完善'];
  openModal(`<h3>上传第 ${v.no + 1} 版方案</h3>
    <label class="f">修改原因（点选）</label>
    ${chips('v_rchip', reasons.map((r) => [r, r]), ['按审查意见修改'], true)}
    <input type="text" id="v_note" class="input-gap" placeholder="选填补充说明">
    ${contentFields(p.category, v)}
    ${btns(`doVersion('${pid}')`, '上传新版')}`);
}

function doVersion(pid) {
  const note = [picked('#v_rchip')[0], $('#v_note')?.value.trim()].filter(Boolean).join(' · ') || '更新方案';
  const c = readContent();
  const hasImgs = c.imgs.a.length || c.imgs.b.length || (c.imgs.c && c.imgs.c.length);
  if (!hasImgs && !c.clause) return toast('请上传方案图件或指标表');
  addVersion(P(pid), { note, ...c });
}

// ---- 阶段更多操作（省略号 ⋯ 收纳：撤回上一阶段、修改信息、修改会议纪要、取消报会、查看流水）----
const menuItem = (onclick, ico, label, sub, danger = false) => `
  <button class="menu-item ${danger ? 'danger' : ''}" onclick="${onclick}">
    ${icon(ico)}
    <span class="menu-main"><span class="menu-label">${label}</span><span class="menu-sub">${sub}</span></span>
    ${icon('chevron-right', 'i-sm')}
  </button>`;

function stageMoreMenuModal(pid) {
  const p = P(pid);
  if (!p) return;
  const canRevert = p.stageIdx > 0;
  const backStageName = canRevert ? stageMeta(p, path(p)[p.stageIdx - 1]).name : '';
  const cur = curStage(p);
  const sCur = p.stages[cur] || {};
  const hasMeeting = !!sCur.meeting;
  const isApplied = !!sCur.apply;

  openModal(`
    <div class="sheet-head">
      <h3>更多操作</h3>
      <span class="muted">${esc(p.alias || p.name)}</span>
    </div>

    <div class="menu-list">
      ${canRevert ? menuItem(`closeModal();revertStage(P('${p.id}'))`, 'undo', '撤回上一阶段', `点错了？撤回至：${esc(backStageName)}`) : ''}
      ${menuItem(`closeModal();editProjectModal('${p.id}')`, 'pencil', '修改项目信息', '名称、俗称、成员、公开范围')}
      ${hasMeeting ? menuItem(`closeModal();meetingModal('${p.id}','${cur}')`, 'file-text', '修改本阶段会议信息', '开会时间、纪要、成果照片') : ''}
      ${isApplied ? menuItem(`closeModal();cancelApplyMeeting('${p.id}','${cur}')`, 'x-circle', '取消本次报会', '撤回排期申请', true) : ''}
      ${menuItem(`closeModal();historyModal('${p.id}')`, 'history', '查看操作记录', `共 ${p.log.length} 条记录`)}
    </div>

    <div class="sheet-actions"><button class="btn text neutral block" onclick="closeModal()">取消</button></div>
  `);
}

// ---- 修改项目基本信息 ----
function editProjectModal(pid) {
  const p = P(pid);
  openModal(`<h3>修改项目信息</h3>
    <label class="f">正式名称</label><input type="text" id="e_name" value="${esc(p.name)}">
    <label class="f">俗称</label><input type="text" id="e_alias" value="${esc(p.alias)}">
    ${memberFieldHtml(p.members)}
    <label class="f">公开给谁看</label>
    ${visibleFieldHtml(p.visible)}
    ${btns(`doEditProject('${pid}')`, '保存')}`);
  renderMemberBadges();
}
function doEditProject(pid) {
  const name = $('#e_name').value.trim();
  if (!name) return toast('请填写名称');
  if (!memberState.length) return toast('请保留至少一位成员');
  const visible = VIS_ROLES.flatMap((r) => picked('#n_v_' + (ROLE_KEYS[r] || r)));
  editProject(P(pid), { name, alias: $('#e_alias').value.trim(), members: memberState, visible });
}

// ===== 顶部收纳一：院长直通车（按需点开、选自己负责的项目）=====
function openDirectChannel() {
  if (U(me).role === '院长') {
    go('dean-notes');
    return;
  }
  // 标记王院长给我的回复为已读
  let touched = false;
  DB.projects.forEach((p) => {
    (p.deanNotes || []).forEach((n) => {
      if (n.by === me && n.status === 'replied' && !n.seenBySender) {
        n.seenBySender = true;
        touched = true;
      }
    });
  });
  if (touched) { save(); updateTopBadges(); }

  const myProjs = DB.projects
    .filter((p) => p.leader === me || p.members.includes(me))
    .sort((a, b) => (b.leader === me ? 1 : 0) - (a.leader === me ? 1 : 0));

  const myHistory = [];
  DB.projects.forEach((p) => {
    (p.deanNotes || []).forEach((n) => {
      if (n.by === me || p.leader === me) myHistory.push({ p, n });
    });
  });

  const topics = ['政策边界请示', '跨部门协调', '指标疑难把关', '急件当面汇报'];

  openModal(`<div class="sheet-head"><h3>${icon('mail')}院长直通车</h3></div>
    ${myProjs.length ? `
      <label class="f">选择你负责/参与的项目</label>
      ${chips('dc_pid', myProjs.map((p) => [p.id, p.alias || p.name]), [myProjs[0].id], true)}

      <label class="f">需要找王院长沟通什么？（点选，细节当面说）</label>
      ${chips('dc_topic', topics.map((t) => [t, t]), [topics[0]], true)}

      <label class="f">紧急程度</label>
      ${chips('dc_urg', [['0', '常规预约'], ['1', '加急']], ['0'], true)}

      <label class="f">补充一句话（选填）</label>
      <input type="text" id="dc_text" placeholder="选填，不填也可直接发送">

      <div class="sheet-actions"><button class="btn block" onclick="doDirectSubmit()">${icon('send')}发送给王院长</button></div>
    ` : `<div class="empty">你当前暂无负责或参与的项目</div>`}

    ${myHistory.length ? `
      <div class="section-split">
        <div class="muted mb-2">我的直通车记录</div>
        ${myHistory.slice().reverse().map(({ p, n }) => `
          <div class="history-item">
            <div class="row nowrap">
              <b>${esc(p.alias || p.name)} · ${esc(n.topic || '请示')}</b>
              <span class="tag ${n.status === 'replied' ? 'done' : ''}">${n.status === 'replied' ? '王院长已约' : '待回复'}</span>
            </div>
            ${n.text ? `<div class="muted mt-1">${esc(n.text)}</div>` : ''}
            ${n.status === 'replied' ? `<div class="meet-line text-done">${icon('calendar', 'i-sm')}${fmtAppt(n.replyTime)} · ${esc(n.replyLoc || '院长办公室')}${n.replyMsg ? '（' + esc(n.replyMsg) + '）' : ''}</div>` : ''}
          </div>`).join('')}
      </div>` : ''}

    <div class="sheet-actions"><button class="btn text neutral block" onclick="closeModal()">关闭</button></div>`);
}

function doDirectSubmit() {
  const pid = picked('#dc_pid')[0];
  if (!pid) return toast('请选择项目');
  const topic = picked('#dc_topic')[0] || '请示沟通';
  const urgent = picked('#dc_urg')[0] === '1';
  const text = $('#dc_text')?.value.trim() || '';
  submitDeanNote(P(pid), { topic, urgent, text });
}

// ---- 王院长回复直通车预约时间 ----
function deanReplyNoteModal(pid, noteId) {
  const p = P(pid);
  const n = (p.deanNotes || []).find((x) => x.id === noteId);
  if (!n) return toast('未找到记录');
  const locs = [['院长办公室', '院长办公室'], ['二楼研讨室', '二楼研讨室'], ['电话/视频', '电话/视频']];

  openModal(`<h3>预约沟通 · ${esc(p.alias || p.name)}</h3>
    <div class="card flat">
      <b>${uname(n.by)}：${esc(n.topic || '请示沟通')}</b>
      ${n.text ? `<div class="muted mt-1">${esc(n.text)}</div>` : ''}
    </div>

    <label class="f">什么时候方便过来？（点选）</label>
    <div class="grid-2 mb-2">
      ${quickTimeBtn('dr_time', '随时过来', 'any')}
      ${quickTimeBtn('dr_time', '今天 16:30', quickTime(0, 16, 30))}
      ${quickTimeBtn('dr_time', '明天 10:00', quickTime(1, 10, 0))}
      ${quickTimeBtn('dr_time', '明天 15:30', quickTime(1, 15, 30))}
    </div>
    <input type="datetime-local" id="dr_time" value="${n.replyTime && n.replyTime !== 'any' ? n.replyTime : quickTime(1, 10, 0)}">

    <label class="f">地点</label>
    ${chips('dr_loc', locs, [n.replyLoc || '院长办公室'], true)}

    ${btns(`doDeanReplyNote('${pid}','${noteId}')`, `${icon('check')}确认并通知`)}`);
}

function doDeanReplyNote(pid, noteId) {
  const replyTime = $('#dr_time').value || 'any';
  const replyLoc = picked('#dr_loc')[0] || '院长办公室';
  deanReplyNote(P(pid), noteId, { replyTime, replyLoc, replyMsg: '' });
}

// ===== 顶部收纳二：控规审查新规（右上角数字红标，点开阅读即消红点）=====
function rulesModal() {
  const isCE = U(me).role === '院总';
  const list = DB.bulletins || [];
  const unread = unreadBulletinCount();

  openModal(`
    <div class="sheet-head">
      <h3>${icon('bell')}审查新规</h3>
      <div class="hstack tight">
        ${unread > 0 ? `<button class="btn sm text neutral" onclick="markAllBulletinsRead();rulesModal()">全部已读</button>` : ''}
        ${isCE ? `<button class="btn sm ghost" onclick="editBulletinModal(null)">${icon('plus')}发布</button>` : ''}
      </div>
    </div>

    ${!list.length ? `<div class="empty">暂无新规</div>` : list.map((b) => {
      const read = isBulletinRead(b.id);
      return `
        <div class="bulletin-card ${read ? '' : 'unread'}" onclick="bulletinDetailModal('${b.id}')">
          <div class="row">
            <span class="tag">${esc(b.tag || '新规')}</span>
            <span class="faint">${esc(b.publishAt || '')}</span>
          </div>
          <div class="b-title">
            ${!read ? '<span class="unread-dot"></span>' : ''}
            <span>${esc(b.title)}</span>
          </div>
          <div class="muted mt-1">${esc(b.summary)}</div>
        </div>`;
    }).join('')}

    ${closeBtn()}
  `);
}

function bulletinDetailModal(id) {
  const b = (DB.bulletins || []).find((x) => x.id === id);
  if (!b) return;
  markBulletinRead(id);
  const isCE = U(me).role === '院总';

  openModal(`
    <div class="page-head">
      <button class="btn sm text neutral" onclick="rulesModal()">${icon('arrow-left')}返回列表</button>
      <span class="faint">${esc(b.publishAt || '')}</span>
    </div>
    <h3>${esc(b.title)}</h3>
    <div class="tags mb-3">
      <span class="tag progress">${esc(b.category)}</span>
      <span class="tag">${esc(b.publisher || '院总工办')}</span>
    </div>
    <div class="info-box text-block">${esc(b.content || b.summary)}</div>
    <div class="btn-row">
      ${isCE ? `
        <button class="btn ghost" onclick="editBulletinModal('${b.id}')">修改</button>
        <button class="btn danger-text" onclick="deleteBulletin('${b.id}');rulesModal()">删除</button>
      ` : ''}
      <button class="btn" onclick="rulesModal()">知道了</button>
    </div>
  `);
}

function publishBulletinModal() { editBulletinModal(null); }

function editBulletinModal(id) {
  const b = id ? (DB.bulletins || []).find((x) => x.id === id) : null;
  openModal(`
    <h3>${b ? '修改新规' : '发布审查新规'}</h3>
    <label class="f">标题</label>
    <input type="text" id="eb_title" value="${esc(b ? b.title : '')}" placeholder="简明一句话标题">

    <label class="f">适用类型</label>
    ${chips('eb_cat', [['全类型通用', '全类型通用'], ...CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => [c, c])], [b ? b.category : '全类型通用'], true)}

    <label class="f">要点内容</label>
    <textarea id="eb_content" rows="4" placeholder="简明写清审查注意点">${esc(b ? b.content : '')}</textarea>

    <div class="sheet-actions">
      <button class="btn block" onclick="doSaveBulletin('${b ? b.id : ''}')">保存发布</button>
      <button class="btn text neutral block" onclick="rulesModal()">返回</button>
    </div>
  `);
}

function doSaveBulletin(id) {
  const title = $('#eb_title').value.trim();
  const content = $('#eb_content').value.trim();
  if (!title || !content) return toast('请填写标题和内容');
  const category = picked('#eb_cat')[0] || '全类型通用';
  const oldB = id ? (DB.bulletins || []).find((x) => x.id === id) : null;
  saveBulletin({
    id: id || ('b_' + Date.now()),
    title,
    category,
    dept: '全院三个所',
    tag: '审查新规',
    priority: 'high',
    publisher: '李院总',
    publishAt: oldB ? oldB.publishAt : now().split(' ')[0],
    summary: content.slice(0, 42) + (content.length > 42 ? '...' : ''),
    content,
  });
}

// ---- 共性问题收集板编辑/推送（院总）----
function editIssueModal(issueId) {
  const iss = (DB.commonIssues || []).find((x) => x.id === issueId) || {};
  openModal(`<h3>共性技术问题</h3>
    <label class="f">标题</label>
    <input type="text" id="ei_title" value="${esc(iss.title || '')}" placeholder="简明标题">
    <label class="f">项目类型</label>
    ${chips('ei_cat', CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => [c, c]), [iss.category || '控规修改'], true)}
    <label class="f">把关提示</label>
    <textarea id="ei_guide" placeholder="简明说明审查注意要点">${esc(iss.guide || iss.problem || '')}</textarea>
    ${btns(`doSaveIssue('${issueId}')`, '保存')}`);
}

function newIssueModal() { editIssueModal('iss' + Date.now()); }

function doSaveIssue(issueId) {
  const title = $('#ei_title').value.trim();
  const guide = $('#ei_guide').value.trim();
  if (!title) return toast('请填写标题');
  const old = (DB.commonIssues || []).find((x) => x.id === issueId) || {};
  saveCommonIssue({
    id: issueId,
    pid: old.pid || '',
    pname: old.pname || '全院通用',
    category: picked('#ei_cat')[0] || '控规修改',
    dept: old.dept || '全院',
    createdAt: old.createdAt || now(),
    by: me,
    title,
    problem: old.problem || '',
    guide,
    broadcasted: old.broadcasted || false,
    broadcastScope: old.broadcastScope || [],
    broadcastAt: old.broadcastAt || '',
  });
}

function broadcastIssueModal(issueId) {
  const iss = (DB.commonIssues || []).find((x) => x.id === issueId);
  if (!iss) return;
  openModal(`<h3>发布至「新规」红标提醒</h3>
    <div class="card flat">
      <b>${esc(iss.title)}</b>
      <div class="muted mt-1">${esc(iss.guide || iss.problem)}</div>
    </div>
    <label class="f">推送范围</label>
    ${chips('bi_scope', DEPTS.map((d) => [d, d]), DEPTS)}
    ${btns(`doBroadcastIssue('${issueId}')`, '立即发布')}`);
}

function doBroadcastIssue(issueId) {
  const scope = picked('#bi_scope');
  if (!scope.length) return toast('请勾选范围');
  broadcastCommonIssue(issueId, scope);
}
