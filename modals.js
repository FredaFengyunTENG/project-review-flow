// ===== 弹窗组件 =====
const btns = (okFn, okText) => `<button class="btn block" onclick="${okFn}">${okText}</button><button class="btn gray block" onclick="closeModal()">取消</button>`;

// ---- 历史操作记录弹窗 ----
function historyModal(pid) {
  const p = P(pid);
  openModal(`<h3>📜 操作记录</h3>
    <div class="muted" style="margin-bottom:10px">${esc(p.alias || p.name)} · 紫色带 ✏️ 为修改记录</div>
    <div style="max-height:60vh;overflow-y:auto;padding-right:4px">
      ${p.log.slice().reverse().map((l) => `<div class="log ${l.edit ? 'edit' : ''}"><b>${l.t}</b>${l.edit ? '✏️ ' : ''}${esc(l.text)}</div>`).join('')}
    </div>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:12px">关闭</button>`);
}

// ---- 送审 ----
function reviewModal(pid) {
  const p = P(pid), def = STAGES[curStage(p)];
  const forms = def.forms || ['预审材料（主要审查指标）'];
  const people = reviewerPool(p).map((u) => [u, `${uname(u)}·${U(u).role}`]);
  const next = suggestNext(p);
  openModal(`<h3>送审 · ${def.name}</h3>
    <label class="f">成果形式</label>${chips('m_form', forms.map((f) => [f, f]), [forms[0]], true)}
    <label class="f">提交方式</label>${chips('m_paper', [['0', '电子档（单独发送，不在本系统上传）'], ['1', '纸质册子']], [curStage(p) === 's1' ? '0' : '1'], true)}
    <label class="f">审查方式</label>${chips('m_mode', [['seq', '逐级审查'], ['par', '同时审查']], ['seq'], true)}
    <label class="f" id="m_whoLabel">送给谁（逐级：选一位，改完再送上一级）</label>
    <div id="m_whoBox">${chips('m_who', people, next ? [next] : [], true)}</div>
    ${curStage(p) === 's1' ? '<div class="muted" style="margin-top:4px">前期阶段电子档，无需送院总审查</div>' : ''}
    <div id="m_reasonBox" style="display:none"><label class="f">同时审查原因（必填，提交即生效）</label>
      <input type="text" id="m_reason" placeholder="例如：明天评审"></div>
    ${btns(`doReview('${pid}')`, '发送送审')}`);
  $('#m_mode').addEventListener('change', () => {
    const par = picked('#m_mode')[0] === 'par';
    $('#m_whoBox').innerHTML = chips('m_who', people, picked('#m_who'), !par);
    $('#m_whoLabel').textContent = par ? '送给谁（可多选）' : '送给谁（逐级：选一位，改完再送上一级）';
    $('#m_reasonBox').style.display = par ? '' : 'none';
  });
}
function doReview(pid) {
  const parallel = picked('#m_mode')[0] === 'par';
  const reviewers = picked('#m_who');
  const reason = $('#m_reason').value.trim();
  if (!reviewers.length) return toast('请选择审查人');
  if (parallel && !reason) return toast('同时审查需要填写原因');
  submitReview(P(pid), { form: picked('#m_form')[0], paper: picked('#m_paper')[0] === '1', parallel, reason, reviewers });
}

function findItem(pid, rid) {
  const p = P(pid), r = p.reviews.find((x) => x.id === rid);
  return { p, r, it: r.items.find((i) => i.uid === me) };
}
function quickTime(addDays, hour) {
  const d = new Date(); d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

// ---- 审查人：接收 + 约送册时间 ----
function acceptModal(pid, rid) {
  const { p, r } = findItem(pid, rid);
  const q = (label, v) => `<button class="btn ghost" onclick="doAccept('${pid}','${rid}','${v}')">${label}</button>`;
  openModal(`<h3>${uname(p.leader)} 请你审查</h3>
    <div class="card"><b>${esc(p.alias || p.name)}</b><div class="muted">${STAGES[r.stage].name} · ${esc(r.form)} · ${r.paper ? '纸质册子' : '电子档'}</div>
    ${r.parallel ? `<span class="tag red">同时审查：${esc(r.reason)}</span>` : ''}</div>
    ${r.paper ? `<label class="f">什么时候方便送册子过来？点一下即可</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${q('随时可送', 'any')}${q('今天 15:00', quickTime(0, 15))}${q('明天 9:00', quickTime(1, 9))}${q('明天 14:00', quickTime(1, 14))}
      </div>
      <label class="f">或选择其他时间</label>
      <input type="datetime-local" id="m_appt" onchange="doAccept('${pid}','${rid}',this.value)">`
    : `<button class="btn block" onclick="doAccept('${pid}','${rid}','');feedbackModal('${pid}','${rid}')">已收到电子档，填写意见</button>`}
    <button class="btn gray block" onclick="closeModal()">稍后处理</button>`);
}
function doAccept(pid, rid, appt) { const { p, r, it } = findItem(pid, rid); acceptReview(p, r, it, appt); }

// ---- 审查意见（新填或修改）----
let fbCount = { dataErr: 0, textErr: 0 };
function bump(k, d) { fbCount[k] = Math.max(0, fbCount[k] + d); $('#c_' + k).textContent = fbCount[k]; }

function feedbackModal(pid, rid) {
  const { p, r, it } = findItem(pid, rid);
  const old = it.feedback && !it.feedback.quick ? it.feedback : {};
  fbCount = { dataErr: old.dataErr || 0, textErr: old.textErr || 0 };
  const isYuanZong = U(me).role === '院总';
  const subReviewers = subordinateReviewers(p); // 仅院总可见，且仅包含所内人员（不可向上通知领导）

  const counter = (k, label) => `<div class="row" style="margin:8px 0"><span>${label}</span><div class="counter">
    <button onclick="bump('${k}',-1)">−</button><b id="c_${k}">${fbCount[k]}</b><button onclick="bump('${k}',1)">＋</button></div></div>`;
  
  openModal(`<h3>${it.status === 'done' ? '修改' : ''}审查意见 · ${esc(p.alias || p.name)}</h3>
    <div class="muted">${STAGES[r.stage].name} · ${esc(r.form)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <button class="btn green" onclick="doFeedback('${pid}','${rid}','已阅，无意见')">已阅，无意见</button>
      <button class="btn green" onclick="doFeedback('${pid}','${rid}','意见见纸质批注')">意见见纸质批注</button>
    </div>
    <div class="muted" style="margin:14px 0 4px;text-align:center">—— 或录入具体意见 ——</div>
    <label class="f">📷 批注页照片 / 截图（可粘贴）</label>${uploader('f_photos', old.photos || [])}
    ${counter('dataErr', '数据错误（处）')}${counter('textErr', '文字错误（处）')}
    <label class="f">重点意见（可用输入法语音输入🎤）</label><textarea id="f_key">${esc(old.key || '')}</textarea>
    <label class="f">其他意见</label><textarea id="f_other" style="min-height:40px">${esc(old.other || '')}</textarea>
    ${isYuanZong && subReviewers.length ? `
      <label class="f">📢 同时通知所内各级审查人员查看此意见（选填）</label>
      ${chips('f_notify', subReviewers.map((u) => [u, `${uname(u)}·${U(u).role}`]))}
      <input type="text" id="f_msg" placeholder="附言（选填），如：指标表格式问题请所内审查时留意" style="margin-top:6px">` : ''}
    ${btns(`doFeedback('${pid}','${rid}')`, '提交意见')}`);
}

function doFeedback(pid, rid, quick = '') {
  const { p, r, it } = findItem(pid, rid);
  const fb = quick ? { quick } : {
    quick: '', ...fbCount, key: $('#f_key').value.trim(), other: $('#f_other').value.trim(), photos: [...UPL.f_photos],
  };
  if (!quick && !fb.dataErr && !fb.textErr && !fb.key && !fb.other && !fb.photos.length) return toast('请至少填写一项，或点「已阅，无意见」');
  submitFeedback(p, r, it, fb, $('#f_notify') ? picked('#f_notify') : [], $('#f_msg')?.value.trim() || '');
}

// ---- 院总向所内各级审查人员推送通知 ----
function notifyModal(pid) {
  const p = P(pid);
  if (U(me).role !== '院总') return toast('该功能仅限院总向所内各级审查人员推送');
  const subs = subordinateReviewers(p);
  if (!subs.length) return toast('本项目暂无所内审查人员');
  openModal(`<h3>📢 通知所内各级审查人员</h3>
    <div class="muted">向所长、所总、组长、校对推送您的审查意见与提示</div>
    <label class="f">通知对象</label>${chips('n_who', subs.map((u) => [u, `${uname(u)}·${U(u).role}`]), subs)}
    <label class="f">附言（选填）</label><textarea id="n_msg" placeholder="如：指标表与道路红线问题具有共性，请各位在后续项目审查中一并注意"></textarea>
    ${btns(`doNotify('${pid}')`, '发送通知')}`);
}
function doNotify(pid) {
  const who = picked('#n_who');
  if (!who.length) return toast('请选择通知对象');
  closeModal(); notifyOthers(P(pid), who, $('#n_msg').value.trim());
}

// ---- 申请报会（直报院长）----
function applyMeetingModal(pid, key) {
  const p = P(pid); key = key || curStage(p);
  const s = st(p, key);
  const old = s.apply || {};

  const defaultMats = [
    '初步方案汇报演示文件 (PPT/PDF)',
    '用地规划图与指标表',
    '所内自审意见落实清单',
    '各专业协同确认单',
  ];
  const curMats = old.materials && old.materials.length ? old.materials : defaultMats.slice(0, 3);

  const quickTimes = [
    '尽快安排',
    '下周二上午 09:30',
    '下周二下午 14:30',
    '下周四上午 09:30',
    '下周四下午 14:30',
  ];
  const curQuick = old.prefQuick || '尽快安排';

  openModal(`<h3>📅 申请报会（直报院长）· ${STAGES[key].name}</h3>
    <div class="card" style="border:1.5px solid #8250df;background:#faf8ff;padding:10px 12px">
      <div class="row">
        <b>直报领导：👑 王院长（院长）</b>
        <span class="tag purple">分院直通审批</span>
      </div>
      <div class="muted" style="margin-top:4px;font-size:12px;line-height:1.4">
        ⚡ 免去各所队先收集、再上报分院、逐级传达的冗长流程。项目自审成熟后一键直报院长日程排期。
      </div>
    </div>

    <label class="f">期望上会时间（点选快捷时段）</label>
    ${chips('a_quick', quickTimes.map((t) => [t, t]), [curQuick], true)}
    <div style="margin-top:6px">
      <input type="datetime-local" id="a_time" value="${old.prefTime || ''}" placeholder="或选择具体日期时间">
    </div>

    <label class="f">报会审查成果就绪核对（可多选）</label>
    ${chips('a_mat', defaultMats.map((m) => [m, m]), curMats)}

    <label class="f">报会说明 / 汇报重点（一两句话说明方案成熟度）</label>
    <textarea id="a_note" placeholder="如：方案已征求所内各级意见自审成熟，指标与道路红线均已核准，特申请分院技术审查会审理。">${esc(old.note || (old.applicant ? '' : '方案已征求所内各级意见自审成熟，指标与道路红线均已核准，特申请分院技术审查会审理。'))}</textarea>

    ${btns(`doApplyMeeting('${pid}','${key}')`, '🚀 立即上报院长')}`);
}

function doApplyMeeting(pid, key) {
  const p = P(pid);
  const prefQuick = picked('#a_quick')[0] || '';
  const prefTime = $('#a_time').value;
  const materials = picked('#a_mat');
  const note = $('#a_note').value.trim();

  if (!prefQuick && !prefTime) return toast('请选择或填写期望上会时间');
  if (!materials.length) return toast('请至少勾选一项已就绪的成果材料');

  applyMeeting(p, {
    targetLeader: 'u1',
    prefQuick,
    prefTime,
    materials,
    note,
  }, key);
}

// ---- 院长审批并排期 ----
function deanScheduleModal(pid, key) {
  const p = P(pid); key = key || curStage(p);
  const s = st(p, key);
  const ap = s.apply || {};
  const people = projectPeople(p).map((u) => [u, `${uname(u)}·${U(u).role}`]);

  const defaultAttendees = uniq([
    me,
    'u2',
    'u3',
    'u5',
    ap.applicant || p.leader,
    ...(p.members || []),
  ]).filter((u) => projectPeople(p).includes(u));

  const roomOptions = [
    ['三楼大会议室', '三楼大会议室'],
    ['二楼研讨室', '二楼研讨室'],
    ['五楼多功能厅', '五楼多功能厅'],
    ['钉钉视频会议', '钉钉视频会议'],
  ];

  openModal(`<h3>🗓 院长审批并排期 · ${STAGES[key].name}</h3>
    <div class="card" style="background:#faf8ff;border:1px solid #d8b4fe">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        <span class="tag purple">报会申请</span>
      </div>
      <div class="muted" style="margin-top:4px">
        申请人：<b>${uname(ap.applicant || p.leader)}</b> · 提交时间：${ap.submittedAt || '刚刚'}
      </div>
      <div style="margin-top:4px;font-size:13px">
        <b>申请人期望时间：</b><span style="color:#8250df;font-weight:600">${esc(ap.prefQuick || fmtAppt(ap.prefTime) || '尽快安排')}</span>
      </div>
      ${ap.materials && ap.materials.length ? `<div style="margin-top:4px;font-size:12px;color:#475569"><b>就绪材料：</b>${ap.materials.map((m) => `<span class="tag">${esc(m)}</span>`).join('')}</div>` : ''}
      ${ap.note ? `<div style="margin-top:4px;font-size:13px;color:#334155;background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e9d5ff"><b>申请说明：</b>${esc(ap.note)}</div>` : ''}
    </div>

    <label class="f">确认排定会议时间</label>
    <input type="datetime-local" id="d_time" value="${ap.scheduledTime || (s.meeting && s.meeting.time) || ''}">
    <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
      <button type="button" class="btn ghost sm" onclick="$('#d_time').value='${quickTime(1, 9)}'">明天 09:30</button>
      <button type="button" class="btn ghost sm" onclick="$('#d_time').value='${quickTime(1, 14)}'">明天 14:30</button>
      <button type="button" class="btn ghost sm" onclick="$('#d_time').value='${quickTime(2, 9)}'">后天 09:30</button>
      <button type="button" class="btn ghost sm" onclick="$('#d_time').value='${quickTime(3, 14)}'">大后天 14:30</button>
    </div>

    <label class="f">会议地点 / 形式</label>
    ${chips('d_loc', roomOptions, [ap.location || (s.meeting && s.meeting.location) || '三楼大会议室'], true)}

    <label class="f">参会人员（系统将自动发送钉钉参会通知）</label>
    ${chips('d_att', people, ap.attendees || (s.meeting && s.meeting.attendees) || defaultAttendees)}

    <label class="f">院长批示 / 会前要求（选填）</label>
    <textarea id="d_opinion" placeholder="如：方案总体成熟，重点审议指标与路网衔接，汇报控制在20分钟内">${esc(ap.deanOpinion || '')}</textarea>

    <button class="btn purple block" onclick="doDeanSchedule('${pid}','${key}')">✔ 批准并发布会议通知</button>
    <button class="btn gray block" onclick="doDeanReject('${pid}','${key}')" style="margin-top:6px">↩ 驳回补充材料</button>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:6px">取消</button>`);
}

function doDeanSchedule(pid, key) {
  const p = P(pid);
  const time = $('#d_time').value;
  const location = picked('#d_loc')[0] || '三楼大会议室';
  const attendees = picked('#d_att');
  const deanOpinion = $('#d_opinion').value.trim();

  if (!time) return toast('请选择排定的会议时间');
  if (!attendees.length) return toast('请选择参会人员');

  deanSchedule(p, { time, location, attendees, deanOpinion }, key);
}

function doDeanReject(pid, key) {
  const reason = prompt('请输入退回原因或材料补正要求：', '方案材料尚不完善，请补充修改后再行报会');
  if (reason === null) return;
  deanRejectMeeting(P(pid), reason.trim(), key);
}

// ---- 会议信息（新填或修改）----
function meetingModal(pid, key) {
  const p = P(pid); key = key || curStage(p);
  const s = p.stages[key] || {};
  const ap = s.apply || {};
  const m = s.meeting || {
    time: ap.scheduledTime || '',
    location: ap.location || '',
    attendees: (ap.attendees && ap.attendees.length) ? ap.attendees : [],
    opinion: '',
    implement: '',
    photos: [],
  };
  const people = projectPeople(p).map((u) => [u, `${uname(u)}·${U(u).role}`]);
  const isScheduled = ap.status === 'scheduled';

  openModal(`<h3>${STAGES[key].name} · 会议信息与纪要</h3>
    ${isScheduled ? `<div class="card" style="background:#faf8ff;border:1px solid #d8b4fe;padding:8px 12px;margin-bottom:10px">
      <div style="font-size:13px;color:#8250df"><b>✅ 院长已排期：</b>${fmtAppt(ap.scheduledTime)} · ${esc(ap.location || '三楼大会议室')}</div>
      ${ap.deanOpinion ? `<div class="muted" style="margin-top:2px;font-size:12px">院长批示：${esc(ap.deanOpinion)}</div>` : ''}
    </div>` : ''}
    <label class="f">上会时间</label><input type="datetime-local" id="g_time" value="${m.time}">
    <label class="f">会议地点</label><input type="text" id="g_loc" value="${esc(m.location || ap.location || '三楼大会议室')}" placeholder="如：三楼大会议室">
    <label class="f">参会人员（仅本项目相关人员）</label>${chips('g_att', people, m.attendees.length ? m.attendees : (ap.attendees || []))}
    <label class="f">会议意见 / 纪要</label><textarea id="g_op">${esc(m.opinion)}</textarea>
    <label class="f">纪要照片 / 截图</label>${uploader('g_photos', m.photos || [])}
    <label class="f">意见落实情况（简单写，哪些没落实）</label><textarea id="g_impl">${esc(m.implement)}</textarea>
    ${btns(`doMeeting('${pid}','${key}')`, '保存会议信息')}`);
}
function doMeeting(pid, key) {
  saveMeeting(P(pid), {
    time: $('#g_time').value,
    location: $('#g_loc').value.trim(),
    attendees: picked('#g_att'),
    opinion: $('#g_op').value.trim(),
    implement: $('#g_impl').value.trim(),
    photos: [...UPL.g_photos],
  }, key);
}

// ---- 上传新方案 ----
function versionModal(pid) {
  const p = P(pid), v = latest(p);
  openModal(`<h3>上传新方案（第 ${v.no + 1} 版）</h3>
    <label class="f">📝 方案修改说明（必填：改了什么、为什么改）</label>
    <textarea id="v_note" placeholder="如：按所总意见，北侧道路红线退让由 5m 调整为 8m"></textarea>
    ${contentFields(p.category, v)}
    ${btns(`doVersion('${pid}')`, '上传新方案')}`);
}
function doVersion(pid) {
  const note = $('#v_note').value.trim();
  if (!note) return toast('请填写修改说明');
  const c = readContent();
  if (!c.imgs.a.length && !c.imgs.b.length && !c.text) return toast('请上传方案图片或填写内容');
  addVersion(P(pid), { note, ...c });
}

// ---- 修改项目基本信息 ----
function editProjectModal(pid) {
  const p = P(pid);
  openModal(`<h3>修改项目信息</h3>
    <label class="f">正式名称</label><input type="text" id="e_name" value="${esc(p.name)}">
    <label class="f">俗称</label><input type="text" id="e_alias" value="${esc(p.alias)}">
    ${memberFieldHtml(p.members)}
    <h2>对谁公开</h2>
    ${visibleFieldHtml(p.visible)}
    <div class="muted" style="margin-top:10px">修改记录将记入流转日志中</div>
    ${btns(`doEditProject('${pid}')`, '保存修改')}`);
  renderMemberBadges();
}
function doEditProject(pid) {
  const name = $('#e_name').value.trim();
  if (!name) return toast('项目名称不能为空');
  if (!memberState.length) return toast('请添加至少一位项目成员');
  const visible = VIS_ROLES.flatMap((r) => picked('#n_v_' + r));
  editProject(P(pid), { name, alias: $('#e_alias').value.trim(), members: memberState, visible });
}
