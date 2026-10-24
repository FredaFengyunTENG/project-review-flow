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
  const p = P(pid), cur = curStage(p), def = stageMeta(p, cur);
  const forms = def.forms || ['预审材料（主要审查指标）'];
  let defaultForm = forms[0];
  // 技术修正按适用条款自动预选对应成果载体（第4/5款默认全套成果，第1~3款默认地块图则）
  if (p.category === '技术修正') {
    const cl = (latest(p) && latest(p).clause) || '';
    if (['第(四)款', '第(五)款'].includes(cl)) {
      const fullForm = forms.find((f) => f.includes('全套成果'));
      if (fullForm) defaultForm = fullForm;
    }
  }
  const people = reviewerPool(p).map((u) => [u, `${uname(u)}·${U(u).role}`]);
  const next = suggestNext(p);
  openModal(`<h3>送审 · ${def.name}</h3>
    ${def.hint ? `<div style="background:#f0f7ff;border-left:3px solid #1f6feb;padding:7px 10px;border-radius:0 6px 6px 0;font-size:12.5px;color:#1e40af;margin-bottom:8px;line-height:1.45">${esc(def.hint)}</div>` : ''}
    <label class="f">成果形式</label>${chips('m_form', forms.map((f) => [f, f]), [defaultForm], true)}
    <label class="f">提交方式</label>${chips('m_paper', [['0', '电子档（单独发送，不在本系统上传）'], ['1', '纸质册子']], [cur === 's1' ? '0' : '1'], true)}
    <label class="f">审查方式</label>${chips('m_mode', [['seq', '逐级审查'], ['par', '同时审查']], ['seq'], true)}
    <label class="f" id="m_whoLabel">送给谁（逐级：选一位，改完再送上一级）</label>
    <div id="m_whoBox">${chips('m_who', people, next ? [next] : [], true)}</div>
    ${cur === 's1' ? '<div class="muted" style="margin-top:4px">前期阶段电子档，无需送院总审查</div>' : ''}
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
    <div class="card"><b>${esc(p.alias || p.name)}</b><div class="muted">${stageMeta(p, r.stage).name} · ${esc(r.form)} · ${r.paper ? '纸质册子' : '电子档'}</div>
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
    <div class="muted">${stageMeta(p, r.stage).name} · ${esc(r.form)}</div>
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
    ${isYuanZong ? `
      <div style="margin-top:14px;background:#f5f3ff;border:1.5px solid #d8b4fe;border-radius:10px;padding:12px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:#6b21a8;font-size:13.5px">
          <input type="checkbox" id="f_to_common" onchange="const b=$('#common_issue_box');if(b)b.style.display=this.checked?'block':'none';">
          💡 提炼为全院普适性问题同步至收集板
        </label>
        <div id="common_issue_box" style="display:none;margin-top:10px">
          <label class="f" style="font-size:12px;color:#581c87">提炼标题（必填）</label>
          <input type="text" id="f_issue_title" placeholder="如：地下指标计算规则与用地图边界不一致">
          <label class="f" style="font-size:12px;color:#581c87;margin-top:6px">核心问题与隐患说明</label>
          <textarea id="f_issue_problem" style="min-height:48px" placeholder="重点指出送审成果中的共性错误或政策脱节隐患"></textarea>
          <label class="f" style="font-size:12px;color:#581c87;margin-top:6px">院总技术指导与全院审查要求</label>
          <textarea id="f_issue_guide" style="min-height:48px" placeholder="对全院三个所该类项目提出的送审前复核要求与规避指引"></textarea>
          <div class="muted" style="font-size:11.5px;margin-top:6px">提交后自动沉淀至「🏛 院总看板 → 普适性问题收集板」，后续可随时修改并一键向三个所通报发布。</div>
        </div>
      </div>` : ''}
    ${btns(`doFeedback('${pid}','${rid}')`, '提交意见')}`);
}

function doFeedback(pid, rid, quick = '') {
  const { p, r, it } = findItem(pid, rid);
  const fb = quick ? { quick } : {
    quick: '', ...fbCount, key: $('#f_key').value.trim(), other: $('#f_other').value.trim(), photos: [...UPL.f_photos],
  };
  if (!quick && !fb.dataErr && !fb.textErr && !fb.key && !fb.other && !fb.photos.length) return toast('请至少填写一项，或点「已阅，无意见」');

  let commonIssueData = null;
  if ($('#f_to_common') && $('#f_to_common').checked) {
    const title = $('#f_issue_title')?.value.trim() || fb.key.slice(0, 24) || '普适性技术审查问题';
    const problem = $('#f_issue_problem')?.value.trim() || fb.key || '详见项目审查批注与意见。';
    const guide = $('#f_issue_guide')?.value.trim() || '全院各所请在同类项目审查把关中重点复核，杜绝类似错误。';
    commonIssueData = {
      id: 'iss' + Date.now(),
      pid: p.id,
      pname: p.alias || p.name,
      category: p.category,
      dept: p.dept || '规划一所',
      createdAt: now(),
      by: me,
      title,
      problem,
      guide,
      broadcasted: false,
      broadcastScope: [],
      broadcastAt: '',
    };
  }

  submitFeedback(p, r, it, fb, $('#f_notify') ? picked('#f_notify') : [], $('#f_msg')?.value.trim() || '', commonIssueData);
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

  openModal(`<h3>📅 申请报会（直报院长）· ${stageMeta(p, key).name}</h3>
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

  openModal(`<h3>🗓 院长审批并排期 · ${stageMeta(p, key).name}</h3>
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
  const meta = stageMeta(p, key);
  const s = p.stages[key] || {};
  const ap = s.apply || {};
  const defaultLoc = key === 's2' ? '三楼大会议室' : key === 's7' ? '市政府会议室' : '市资源规划局会议室';
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

  openModal(`<h3>${meta.name} · 会议信息与纪要</h3>
    ${meta.hint ? `<div style="background:#f5f3ff;border-left:3px solid #8250df;padding:7px 10px;border-radius:0 6px 6px 0;font-size:12.5px;color:#581c87;margin-bottom:8px;line-height:1.45">${esc(meta.hint)}</div>` : ''}
    ${isScheduled ? `<div class="card" style="background:#faf8ff;border:1px solid #d8b4fe;padding:8px 12px;margin-bottom:10px">
      <div style="font-size:13px;color:#8250df"><b>✅ 院长已排期：</b>${fmtAppt(ap.scheduledTime)} · ${esc(ap.location || '三楼大会议室')}</div>
      ${ap.deanOpinion ? `<div class="muted" style="margin-top:2px;font-size:12px">院长批示：${esc(ap.deanOpinion)}</div>` : ''}
    </div>` : ''}
    <label class="f">上会时间</label><input type="datetime-local" id="g_time" value="${m.time}">
    <label class="f">会议地点</label><input type="text" id="g_loc" value="${esc(m.location || ap.location || defaultLoc)}" placeholder="如：${defaultLoc}">
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
  const prevFeedbacks = [];
  p.reviews.forEach((r) => {
    r.items.forEach((it) => {
      if (it.status === 'done' && it.feedback) {
        const fb = it.feedback;
        let desc = '';
        if (fb.key) desc += fb.key;
        if (fb.dataErr) desc += (desc ? '；' : '') + `数据错误 ${fb.dataErr} 处`;
        if (fb.textErr) desc += (desc ? '；' : '') + `文字错误 ${fb.textErr} 处`;
        if (fb.other) desc += (desc ? '；' : '') + `其他：${fb.other}`;
        if (!desc && fb.quick && fb.quick !== '已阅，无意见') desc = fb.quick;
        if (desc) {
          prevFeedbacks.push({
            uid: it.uid,
            role: U(it.uid).role,
            stage: r.stage,
            stageName: stageMeta(p, r.stage).name || '审查阶段',
            form: r.form,
            desc,
          });
        }
      }
    });
  });

  const resHtml = prevFeedbacks.length ? `
    <div style="margin:14px 0 8px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:12px">
      <div class="row">
        <b style="font-size:13.5px;color:#1e293b">📋 审查意见修改落实对照清单</b>
        <span class="tag blue" style="font-size:11px">质量闭环</span>
      </div>
      <div class="muted" style="font-size:12px;margin:4px 0 8px">
        系统已调取往轮审查批注，请逐条填写落实说明及图纸页码：
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${prevFeedbacks.map((item, idx) => `
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px">
            <div class="row" style="font-size:12.5px">
              <b>${uname(item.uid)} <span class="muted">（${item.role} · ${item.stageName}）</span></b>
              <span class="tag orange">待落实</span>
            </div>
            <div style="margin-top:4px;font-size:12.5px;color:#334155;background:#f1f5f9;padding:6px 8px;border-radius:6px">
              💬 审查批注：${esc(item.desc)}
            </div>
            <label class="f" style="font-size:12px;margin-top:6px;color:#0969da">修改落实情况及图纸页码：</label>
            <textarea class="res-item-reply" data-uid="${item.uid}" data-role="${item.role}" data-stage="${item.stage}" data-summary="${esc(item.desc)}" placeholder="如：已按意见修正指标表地下商业面积为 12000㎡，详见 P12 规划指标表及 P15 附图说明" style="min-height:46px"></textarea>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  openModal(`<h3>上传新方案（第 ${v.no + 1} 版）</h3>
    <label class="f">📝 方案修改总说明（必填：改了什么、为什么改）</label>
    <textarea id="v_note" placeholder="如：按校对意见修正指标表地下面积；北侧道路红线退让由 5m 调整为 8m"></textarea>
    ${resHtml}
    ${contentFields(p.category, v)}
    ${btns(`doVersion('${pid}')`, '上传新方案')}`);
}

function doVersion(pid) {
  const note = $('#v_note').value.trim();
  if (!note) return toast('请填写修改说明');
  const c = readContent();
  if (!c.imgs.a.length && !c.imgs.b.length && !(c.imgs.c && c.imgs.c.length) && !c.text) return toast('请上传方案图片或填写内容');

  const resolutions = [];
  $$('.res-item-reply').forEach((el, idx) => {
    const reply = el.value.trim();
    if (reply) {
      resolutions.push({
        id: 'res_' + Date.now() + '_' + idx,
        reviewerUid: el.dataset.uid,
        reviewerRole: el.dataset.role,
        stage: el.dataset.stage,
        feedbackSummary: el.dataset.summary,
        reply,
        resolved: false,
        resolvedBy: '',
        resolvedAt: '',
      });
    }
  });

  addVersion(P(pid), { note, ...c, resolutions });
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

// ---- 院长直通车：递小纸条 ----
function deanNoteModal(pid) {
  const p = P(pid);
  openModal(`<h3>✉️ 院长直通车 · 递小纸条给王院长</h3>
    <div class="card" style="border:1.5px solid #8250df;background:#faf8ff;padding:10px 12px">
      <div class="row">
        <b>直通领导：👑 王院长（分院院长）</b>
        <span class="tag purple">急件直接呈递</span>
      </div>
      <div class="muted" style="margin-top:4px;font-size:12px;line-height:1.4">
        ⚡ 针对特殊规划难题、政策疑难、跨部门/跨所协调或需请示院长的紧急问题，无需纸质逐级流转，直达院长。王院长将回复并预约面谈沟通时间。
      </div>
    </div>
    <div class="muted" style="margin:8px 0 2px">所属项目：<b>${esc(p.alias || p.name)}</b> <span class="tag">${p.dept || '规划一所'}</span></div>
    <label class="f">紧急程度</label>
    ${chips('dn_urg', [['0', '普通请示沟通'], ['1', '加急紧急协调']], ['0'], true)}
    <label class="f">小纸条内容（一两句话说明请示事项或需要院长指导的问题）</label>
    <textarea id="dn_text" placeholder="如：东湖地块容积率调整涉及周边限高与相邻单位前置协调，规划局要求出具分院核准说明，恳请王院长安排时间指导沟通。"></textarea>
    <label class="f">📷 附图 / 截图（选填）</label>
    ${uploader('dn_photos', [])}
    ${btns(`doSubmitDeanNote('${pid}')`, '🚀 立即呈递王院长')}`);
}

function doSubmitDeanNote(pid) {
  const text = $('#dn_text').value.trim();
  if (!text) return toast('请填写小纸条内容');
  const urgent = picked('#dn_urg')[0] === '1';
  submitDeanNote(P(pid), {
    text,
    urgent,
    photos: [...(UPL.dn_photos || [])],
  });
}

// ---- 院长直通车：王院长回复预约时间 ----
function deanReplyNoteModal(pid, noteId) {
  const p = P(pid);
  const n = (p.deanNotes || []).find((x) => x.id === noteId);
  if (!n) return toast('未找到该小纸条');

  const q = (label, v, loc = '院长办公室') =>
    `<button type="button" class="btn ghost sm" onclick="$('#dr_time').value='${v}';$('#dr_loc_input').value='${loc}'">${label}</button>`;

  openModal(`<h3>✉️ 回复直通车小纸条 · 预约沟通时间</h3>
    <div class="card" style="border:1.5px solid #8250df;background:#faf8ff">
      <div class="row">
        <b>${esc(p.alias || p.name)}</b>
        <span class="tag ${n.urgent ? 'red' : 'purple'}">${n.urgent ? '🚨 加急请示' : '✉️ 小纸条'}</span>
      </div>
      <div class="muted" style="margin-top:4px">
        递送人：<b>${uname(n.by)}</b>（${p.dept || '规划一所'}） · 递送时间：${n.at}
      </div>
      <div style="margin-top:6px;font-size:13.5px;color:#1e293b;background:#fff;padding:8px 10px;border-radius:6px;border:1px solid #e9d5ff">
        📝 ${esc(n.text)}
      </div>
      ${n.photos && n.photos.length ? `<div style="margin-top:6px">${imgsHtml(n.photos)}</div>` : ''}
    </div>

    <label class="f">什么时候方便项目组过来面谈？点选快捷时间</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${q('随时到办公室来', 'any')}
      ${q('今天 16:30', quickTime(0, 16).replace(':00', ':30'))}
      ${q('明天 10:00', quickTime(1, 10))}
      ${q('明天 15:30', quickTime(1, 15).replace(':00', ':30'))}
      ${q('后天 10:00', quickTime(2, 10))}
      ${q('下周一 09:30', quickTime(3, 9).replace(':00', ':30'))}
    </div>

    <label class="f" style="margin-top:10px">或自定义预约时间</label>
    <input type="datetime-local" id="dr_time" value="${n.replyTime || ''}">

    <label class="f">面谈地点 / 沟通方式</label>
    ${chips('dr_loc', [['院长办公室', '院长办公室'], ['钉钉视频/电话', '钉钉视频/电话'], ['二楼研讨室', '二楼研讨室'], ['三楼大会议室', '三楼大会议室']], [n.replyLoc || '院长办公室'], true)}
    <input type="text" id="dr_loc_input" value="${esc(n.replyLoc || '院长办公室')}" style="margin-top:6px" placeholder="地点">

    <label class="f">院长批示 / 准备要求（选填）</label>
    <textarea id="dr_msg" placeholder="如：带上方案总图与技术指标表过来面谈，已跟局里领导初步沟通。">${esc(n.replyMsg || '')}</textarea>

    <button class="btn purple block" onclick="doDeanReplyNote('${pid}','${noteId}')">✔ 确认预约并回复项目组</button>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:6px">稍后处理</button>`);
}

function doDeanReplyNote(pid, noteId) {
  const p = P(pid);
  const replyTime = $('#dr_time').value || 'any';
  const replyLoc = $('#dr_loc_input').value.trim() || picked('#dr_loc')[0] || '院长办公室';
  const replyMsg = $('#dr_msg').value.trim();
  deanReplyNote(p, noteId, { replyTime, replyLoc, replyMsg });
}

// ---- 院长批量合并排定期分院技术审查会 ----
function deanBatchScheduleModal() {
  const applies = deanPendingApplies();
  if (!applies.length) return toast('暂无待排期的报会申请');

  const allAttendees = uniq([
    me, 'u2', 'u3', 'u4', 'u5', 'u6',
    ...applies.flatMap((a) => [a.p.leader, ...(a.p.members || [])]),
  ]);
  const people = USERS.filter((u) => allAttendees.includes(u.id)).map((u) => [u.id, `${u.name}·${u.role}`]);

  openModal(`<h3>🗓 批量排定分院技术审查会 · 王院长</h3>
    <div class="card" style="background:#faf8ff;border:1.5px solid #8250df;padding:10px 12px">
      <b>⚡ 已勾选合并上会项目（共 ${applies.length} 项）</b>
      <div class="muted" style="margin-top:4px;font-size:12px">
        已达集中开会建议量。将统一排定会议时段与会议室，系统自动向全体参会人员发送合并会议通知。
      </div>
    </div>

    <label class="f">选择本次上会项目</label>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${applies.map(({ p, apply }) => `
        <label class="card" style="margin:0;padding:8px 10px;display:flex;gap:10px;align-items:flex-start;cursor:pointer">
          <input type="checkbox" name="bs_pids" value="${p.id}" checked style="margin-top:4px;width:auto">
          <div style="flex:1">
            <div class="row"><b>${esc(p.alias || p.name)}</b><span class="tag purple">${p.dept || '规划一所'}</span></div>
            <div class="muted" style="font-size:12px;margin-top:2px">申请人：${uname(apply.applicant || p.leader)} · 期望：${esc(apply.prefQuick || fmtAppt(apply.prefTime))}</div>
            ${apply.note ? `<div style="font-size:12px;color:#475569;margin-top:2px">自审说明：${esc(apply.note)}</div>` : ''}
          </div>
        </label>`).join('')}
    </div>

    <label class="f" style="margin-top:12px">会议时间</label>
    <input type="datetime-local" id="bs_time" value="${quickTime(1, 9)}">
    <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
      <button type="button" class="btn ghost sm" onclick="$('#bs_time').value='${quickTime(1, 9)}'">明天 09:30</button>
      <button type="button" class="btn ghost sm" onclick="$('#bs_time').value='${quickTime(1, 14)}'">明天 14:30</button>
      <button type="button" class="btn ghost sm" onclick="$('#bs_time').value='${quickTime(2, 9)}'">后天 09:30</button>
    </div>

    <label class="f">会议地点</label>
    ${chips('bs_loc', [['三楼大会议室', '三楼大会议室'], ['二楼研讨室', '二楼研讨室'], ['五楼多功能厅', '五楼多功能厅'], ['钉钉视频会议', '钉钉视频会议']], ['三楼大会议室'], true)}

    <label class="f">参会人员（已自动合并各项目关键人员）</label>
    ${chips('bs_att', people, allAttendees)}

    <label class="f">院长批示 / 会议组织要求</label>
    <textarea id="bs_op" placeholder="如：各项目汇报时间严格控制在 20 分钟内，重点汇报指标调整合理性与交通配套落实情况。">本次技术审查会合并审议，请各项目组按次序汇报（每项 20 分钟），重点审议规划指标与红线协同。</textarea>

    <button class="btn purple block" onclick="doDeanBatchSchedule()">✔ 批量排期开会并通知全员</button>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:6px">取消</button>`);
}

function doDeanBatchSchedule() {
  const pids = $$('input[name="bs_pids"]:checked').map((x) => x.value);
  if (!pids.length) return toast('请至少勾选一个上会项目');
  const time = $('#bs_time').value;
  if (!time) return toast('请选择排定的会议时间');
  const location = picked('#bs_loc')[0] || '三楼大会议室';
  const attendees = picked('#bs_att');
  const deanOpinion = $('#bs_op').value.trim();

  deanBatchSchedule(pids, { time, location, attendees, deanOpinion });
}

// ---- 普适性技术问题收集板：编辑 / 新增 ----
function editIssueModal(issueId) {
  const iss = (DB.commonIssues || []).find((x) => x.id === issueId) || {};
  openModal(`<h3>✏️ 修改普适性技术问题</h3>
    <label class="f">问题摘要 / 标题</label>
    <input type="text" id="ei_title" value="${esc(iss.title || '')}" placeholder="如：指标表地下建筑面积计算规则不一致">

    <label class="f">对应规划项目类型</label>
    ${chips('ei_cat', CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => [c, c]), [iss.category || '控规修改'], true)}

    <label class="f">来源项目及所属所队（选填）</label>
    <input type="text" id="ei_pname" value="${esc(iss.pname || '')}" placeholder="如：某某片区局部修改 (东湖地块)">

    <label class="f">高频共性问题描述（具体是什么问题需要注意）</label>
    <textarea id="ei_prob" style="min-height:70px" placeholder="描述具体是什么问题需要注意">${esc(iss.problem || '')}</textarea>

    <label class="f">💡 院总提示与把关要求（对全院的执行指引）</label>
    <textarea id="ei_guide" style="min-height:70px" placeholder="说明院内规范或统一的技术尺度要求">${esc(iss.guide || '')}</textarea>

    <button class="btn purple block" onclick="doSaveIssue('${issueId}')">保存并更新收集板</button>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:6px">取消</button>`);
}

function newIssueModal() {
  const newId = 'iss' + Date.now();
  editIssueModal(newId);
}

function doSaveIssue(issueId) {
  const title = $('#ei_title').value.trim();
  const problem = $('#ei_prob').value.trim();
  const guide = $('#ei_guide').value.trim();
  const category = picked('#ei_cat')[0] || '控规修改';
  const pname = $('#ei_pname').value.trim() || '全院通用经验';

  if (!title) return toast('请填写问题摘要');
  if (!problem && !guide) return toast('请填写问题描述或院总提示要求');

  const old = (DB.commonIssues || []).find((x) => x.id === issueId) || {};
  saveCommonIssue({
    id: issueId,
    pid: old.pid || '',
    pname,
    category,
    dept: old.dept || '全院',
    createdAt: old.createdAt || now(),
    by: me,
    title,
    problem,
    guide,
    broadcasted: old.broadcasted || false,
    broadcastScope: old.broadcastScope || [],
    broadcastAt: old.broadcastAt || '',
  });
}

// ---- 院总推送普适性技术问题至全院 ----
function broadcastIssueModal(issueId) {
  const iss = (DB.commonIssues || []).find((x) => x.id === issueId);
  if (!iss) return toast('未找到该问题');

  openModal(`<h3>📢 推送普适性技术问题至全院</h3>
    <div class="card" style="border:1.5px solid #8250df;background:#faf8ff">
      <div class="row">
        <b>${esc(iss.title)}</b>
        <span class="tag blue">${esc(iss.category)}</span>
      </div>
      <div style="font-size:13px;color:#475569;margin-top:6px;line-height:1.45">
        <b>问题描述：</b>${esc(iss.problem)}
      </div>
      <div style="font-size:13px;color:#7c3aed;margin-top:6px;line-height:1.45;background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e9d5ff">
        <b>院总提示：</b>${esc(iss.guide)}
      </div>
    </div>

    <label class="f">选择推送范围（我们有三个所）</label>
    ${chips('bi_scope', DEPTS.map((d) => [d, d]), iss.broadcastScope && iss.broadcastScope.length ? iss.broadcastScope : DEPTS)}

    <label class="f">推送附言 / 院总通知（选填）</label>
    <textarea id="bi_msg" placeholder="如：近期各所此类问题多发，请各所长、所总在项目内审时严格复核，统一全院技术尺度。">近期在项目审查中发现此类共性问题频发，请各所长、所总及项目负责人在内部审查中严格按此要求执行。</textarea>

    <button class="btn purple block" onclick="doBroadcastIssue('${issueId}')">🚀 立即发送给所选所队（全院）</button>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:6px">取消</button>`);
}

function doBroadcastIssue(issueId) {
  const scope = picked('#bi_scope');
  if (!scope.length) return toast('请至少勾选一个接收所队');
  const msg = $('#bi_msg').value.trim();
  broadcastCommonIssue(issueId, scope, msg);
}

// ===== 院技术公告板弹窗 =====
function bulletinDetailModal(id) {
  const b = (DB.bulletins || []).find((x) => x.id === id);
  if (!b) return toast('公告不存在或已被撤回');

  const isCE = U(me).role === '院总';
  const tagColor = b.priority === 'high' ? 'red' : (b.tag === '审查新需求' ? 'blue' : 'purple');

  const checkHtml = (b.checklist || []).length ? `
    <div style="margin:12px 0;background:#f8fbff;border:1px solid #d0e2ff;border-radius:8px;padding:12px">
      <div style="font-weight:600;font-size:13.5px;color:#0969da;margin-bottom:8px">✅ 送审前必查清单（设计人员逐条自查）</div>
      ${b.checklist.map((c, i) => `
        <label class="check-item" style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:13px;cursor:pointer">
          <input type="checkbox" style="margin-top:2px" id="chk_${b.id}_${i}">
          <span style="color:#24292f">${esc(c)}</span>
        </label>
      `).join('')}
    </div>` : '';

  openModal(`
    <div class="row" style="margin-bottom:8px">
      <span class="tag ${tagColor}">${b.tag || '审查新需求'}</span>
      <span class="tag ${b.priority === 'high' ? 'red' : 'green'}">${b.priority === 'high' ? '🚨 重点必查' : '常规指引'}</span>
      <span class="muted" style="font-size:12px;margin-left:auto">${b.publishAt}</span>
    </div>

    <h3 style="font-size:16px;line-height:1.4;margin:4px 0 10px">${esc(b.title)}</h3>

    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
      <span class="tag blue">适用：${esc(b.category)}</span>
      <span class="tag">范围：${esc(b.dept)}</span>
      <span class="tag">发布：${esc(b.publisher)}</span>
      ${b.relatedProject ? `<span class="tag orange">关联：${esc(b.relatedProject)}</span>` : ''}
    </div>

    <div style="background:#f6f8fa;border-left:3px solid #1f6feb;padding:8px 12px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.5;margin-bottom:12px">
      <b>💡 核心需求速览：</b><br>${esc(b.summary)}
    </div>

    <div style="font-size:13.5px;line-height:1.6;color:#24292f;white-space:pre-wrap;margin-bottom:12px">
      ${esc(b.content)}
    </div>

    ${checkHtml}

    <div style="margin-top:16px;display:flex;gap:8px">
      ${isCE ? `
        <button class="btn ghost sm" onclick="editBulletinModal('${b.id}')" style="flex:1">✏️ 修改公告</button>
        <button class="btn gray sm" onclick="deleteBulletin('${b.id}');closeModal();" style="flex:1;color:#cf222e">🗑 撤回</button>
      ` : ''}
      <button class="btn ${isCE ? 'gray sm' : 'block'}" onclick="closeModal()" style="${isCE ? 'flex:1' : ''}">已阅读理解</button>
    </div>
  `);
}

function publishBulletinModal() {
  editBulletinModal(null);
}

function editBulletinModal(id) {
  const b = id ? (DB.bulletins || []).find((x) => x.id === id) : null;
  const isNew = !b;

  const currentDepts = b ? (b.dept === '全院三个所' ? DEPTS : b.dept.split('、')) : DEPTS;

  openModal(`
    <h3>${isNew ? '➕ 发布新技术审查需求公告' : '✏️ 修改院技术公告'}</h3>
    <div class="muted" style="margin-top:-6px;margin-bottom:12px">向全院或指定所队通报新的项目审查要求与技术规范</div>

    <label class="f">公告标题</label>
    <input type="text" id="eb_title" value="${esc(b ? b.title : '【审查新规】')}" placeholder="如：【审查新规】控规修改商业兼容比例超15%须提交交通承载力简析">

    <label class="f">适用项目类型</label>
    ${chips('eb_cat', [['全类型通用', '全类型通用'], ...CATEGORIES.filter((c) => c !== '其他（待开发）').map((c) => [c, c])], [b ? b.category : '控规修改'], true)}

    <label class="f">适用所队范围</label>
    ${chips('eb_dept', DEPTS.map((d) => [d, d]), currentDepts)}

    <div class="row" style="margin-top:10px">
      <div style="flex:1">
        <label class="f" style="margin-top:0">公告类型</label>
        <select id="eb_tag">
          <option value="审查新需求" ${b && b.tag === '审查新需求' ? 'selected' : ''}>审查新需求</option>
          <option value="共性问题通报" ${b && b.tag === '共性问题通报' ? 'selected' : ''}>共性问题通报</option>
          <option value="送审清单" ${b && b.tag === '送审清单' ? 'selected' : ''}>送审清单</option>
          <option value="规范更新" ${b && b.tag === '规范更新' ? 'selected' : ''}>规范更新</option>
        </select>
      </div>
      <div style="flex:1">
        <label class="f" style="margin-top:0">紧急程度</label>
        <select id="eb_priority">
          <option value="high" ${b && b.priority === 'high' ? 'selected' : ''}>🚨 重点必查</option>
          <option value="normal" ${!b || b.priority === 'normal' ? 'selected' : ''}>常规指引</option>
        </select>
      </div>
    </div>

    <label class="f">需求摘要（卡片速览提示）</label>
    <textarea id="eb_summary" rows="2" placeholder="简要概括审查新要求，1~2句话">${esc(b ? b.summary : '')}</textarea>

    <label class="f">详细技术审查要求与背景说明</label>
    <textarea id="eb_content" rows="4" placeholder="详细阐述具体技术审查规范、易错点与应对方法">${esc(b ? b.content : '')}</textarea>

    <label class="f">送审前自查点清单（每行一项，方便设计人员逐条自查）</label>
    <textarea id="eb_check" rows="3" placeholder="每行一条，例如：\n核对商业/办公兼容比例是否超出 15%\n补充周边支路早晚高峰交通承载能力测算表">${esc(b && b.checklist ? b.checklist.join('\n') : '')}</textarea>

    <label class="f">关联项目名称（选填）</label>
    <input type="text" id="eb_rel" value="${esc(b ? (b.relatedProject || '') : '')}" placeholder="如：某某片区局部修改 (东湖地块)">

    <button class="btn purple block" onclick="doSaveBulletin('${b ? b.id : ''}')">${isNew ? '📢 立即发布至全院公告板' : '💾 保存修改'}</button>
    <button class="btn gray block" onclick="closeModal()" style="margin-top:6px">取消</button>
  `);
}

function doSaveBulletin(id) {
  const title = $('#eb_title').value.trim();
  if (!title) return toast('请输入公告标题');
  const cat = picked('#eb_cat')[0] || '全类型通用';
  const depts = picked('#eb_dept');
  if (!depts.length) return toast('请至少选择一个适用所队');
  const tag = $('#eb_tag').value;
  const priority = $('#eb_priority').value;
  const summary = $('#eb_summary').value.trim();
  const content = $('#eb_content').value.trim();
  if (!summary || !content) return toast('请填写需求摘要与详细审查要求');

  const checkText = $('#eb_check').value.trim();
  const checklist = checkText ? checkText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const relatedProject = $('#eb_rel').value.trim();

  const isNew = !id;
  const oldB = id ? (DB.bulletins || []).find((x) => x.id === id) : null;

  const item = {
    id: id || ('b_' + Date.now()),
    title,
    category: cat,
    dept: depts.length === DEPTS.length ? '全院三个所' : depts.join('、'),
    tag,
    priority,
    publisher: oldB ? oldB.publisher : '李院总（院总工办）',
    publishAt: oldB ? oldB.publishAt : now(),
    summary,
    content,
    checklist,
    relatedProject,
  };

  saveBulletin(item);
}
