// ===== 状态与通用工具 =====
const KEY = 'review-proto-v11';
let DB = JSON.parse(localStorage.getItem(KEY) || 'null') || {
  projects: seedProjects(),
  commonIssues: seedCommonIssues(),
  bulletins: seedBulletins(),
  readBulletins: {},
};
if (!DB.projects || !DB.projects.find((p) => p.id === 'p7') || !DB.bulletins) {
  DB = { projects: seedProjects(), commonIssues: seedCommonIssues(), bulletins: seedBulletins(), readBulletins: {} };
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
}
DB.readBulletins = DB.readBulletins || {};

let me = localStorage.getItem(KEY + '-me') || 'u10';
let route = { name: 'todo' };
let ceFilter = { dept: 'all', cat: 'all' };

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const U = (id) => USERS.find((u) => u.id === id) || { name: '?', role: '' };
const uname = (id) => U(id).name;
const P = (id) => DB.projects.find((p) => p.id === id);
const uniq = (a) => [...new Set(a)];

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { toast('⚠️ 浏览器存储已满，请少传几张图或重置示例数据', 5000); }
}
function pad(n) { return String(n).padStart(2, '0'); }
function now() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtAppt(v) { return !v ? '' : v === 'any' ? '随时可送' : v.replace('T', ' '); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function canSee(p, uid) { return p.members.includes(uid) || p.visible.includes(uid); }
function isTeam(p) { return p.members.includes(me); }
function path(p) { return stagePath(p.category, p.publicity); }
function curStage(p) { return path(p)[p.stageIdx]; }
function st(p, key) { return (p.stages[key] = p.stages[key] || {}); }
function finished(p) { return p.stageIdx >= path(p).length; }
function latest(p) { return p.versions[p.versions.length - 1]; }
function projectPeople(p) { return uniq([...p.members, ...p.visible]); }

function go(name, arg) { route = { name, arg }; render(); window.scrollTo(0, 0); }
function openModal(html) {
  $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden');
  const first = $('#sheet .upl'); lastUpl = first ? first.id : null;
}
function closeModal() { $('#modal').classList.add('hidden'); lastUpl = null; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.title = '点击关闭';
  t.onclick = () => t.remove();
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function log(p, text, edit = false) { p.log.push({ t: now(), text, edit }); }
function notify(uids, msg) { if (uids.length) toast(`📨 已通知 ${uids.map(uname).join('、')}：${msg}`, 4200); }

// ===== 顶部收纳按钮红标计数（新规 + 直通车）=====
function unreadBulletinCount() {
  const readSet = new Set((DB.readBulletins && DB.readBulletins[me]) || []);
  return (DB.bulletins || []).filter((b) => !readSet.has(b.id)).length;
}
function isBulletinRead(id) {
  return ((DB.readBulletins && DB.readBulletins[me]) || []).includes(id);
}
function markBulletinRead(id) {
  DB.readBulletins = DB.readBulletins || {};
  const arr = DB.readBulletins[me] || [];
  if (!arr.includes(id)) {
    DB.readBulletins[me] = [...arr, id];
    save();
  }
  updateTopBadges();
}
function markAllBulletinsRead() {
  DB.readBulletins = DB.readBulletins || {};
  DB.readBulletins[me] = (DB.bulletins || []).map((b) => b.id);
  save();
  updateTopBadges();
}
function directBadgeCount() {
  if (U(me).role === '院长') return deanPendingNotes().length;
  let cnt = 0;
  DB.projects.forEach((p) => {
    (p.deanNotes || []).forEach((n) => {
      if (n.by === me && n.status === 'replied' && !n.seenBySender) cnt++;
    });
  });
  return cnt;
}
function updateTopBadges() {
  const rb = $('#ruleBadge');
  if (rb) {
    const n = unreadBulletinCount();
    rb.textContent = n;
    rb.classList.toggle('hidden', n <= 0);
  }
  const db = $('#directBadge');
  if (db) {
    const d = directBadgeCount();
    db.textContent = d;
    db.classList.toggle('hidden', d <= 0);
  }
}

// ===== 点选胶囊组件 =====
document.addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  const box = c.parentElement;
  if (!box || !box.classList.contains('chips')) return;
  if (box.dataset.single) {
    box.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
    c.classList.add('on');
  } else {
    c.classList.toggle('on');
  }
  box.dispatchEvent(new Event('change'));
});
function picked(sel) { return $$(`${sel} .chip.on`).map((c) => c.dataset.v); }
function chips(id, items, selected = [], single = false) {
  return `<div class="chips" id="${id}" ${single ? 'data-single="1"' : ''}>` +
    items.map(([v, label]) => `<span class="chip ${selected.includes(v) ? 'on' : ''}" data-v="${esc(v)}">${esc(label)}</span>`).join('') +
    '</div>';
}

// ===== 精简图片上传框：拍照/选图/粘贴截图 =====
const UPL = {};
let lastUpl = null;
function uploader(id, init = [], title = '') {
  UPL[id] = [...init];
  return `<div class="upl" id="${id}" tabindex="0" onfocus="lastUpl='${id}'" onclick="lastUpl='${id}';this.classList.add('act')" onblur="this.classList.remove('act')">
    ${title ? `<div class="upl-title"><span>${esc(title)}</span><span class="muted" style="font-size:11px;font-weight:normal">可粘贴</span></div>` : ''}
    <div class="thumbs" id="${id}_t">${thumbsHtml(id)}</div>
    <div class="upl-bar">
      <label class="btn sm ghost" style="padding:4px 9px;font-size:12px">📷 传图<input type="file" accept="image/*" multiple hidden onchange="addFiles('${id}',this.files)"></label>
      ${!title ? '<span class="muted" style="font-size:11.5px">点此框可 ⌘V / Ctrl+V 粘贴截图</span>' : ''}
    </div></div>`;
}
function thumbsHtml(id) {
  return (UPL[id] || []).map((f, i) => `<span class="thumb">${f.src ? `<img src="${f.src}" onclick="viewImg(this.src)">` : `<span class="noimg">📷<br>${esc(f.name)}</span>`}<i onclick="event.stopPropagation();rmImg('${id}',${i})">×</i></span>`).join('');
}
function rmImg(id, i) { UPL[id].splice(i, 1); const box = $('#' + id + '_t'); if (box) box.innerHTML = thumbsHtml(id); }
async function addFiles(id, files) {
  for (const f of files) if (f && f.type.startsWith('image/')) UPL[id].push({ name: f.name || '截图.png', src: await shrink(f) });
  const box = $('#' + id + '_t'); if (box) box.innerHTML = thumbsHtml(id);
}
function shrink(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => res(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
document.addEventListener('paste', (e) => {
  const target = document.activeElement?.dataset?.upl || lastUpl;
  if (!target || !document.getElementById(target)) return;
  const files = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile());
  if (!files.length) return;
  e.preventDefault(); addFiles(target, files); toast('✅ 已粘贴截图');
});
function imgsHtml(list = []) {
  return (list || []).map((f) => f.src ? `<img class="mini" src="${f.src}" onclick="viewImg(this.src)">` : `<span class="tag">📷 ${esc(f.name)}</span>`).join('');
}
function viewImg(src) {
  const o = document.createElement('div'); o.className = 'imgview';
  o.innerHTML = `<img src="${src}">`; o.onclick = () => o.remove(); document.body.appendChild(o);
}

// ===== 核心业务动作 =====
function createProject(d) {
  const leaderDept = U(d.leader).dept;
  const dept = d.dept || (DEPTS.includes(leaderDept) ? leaderDept : '规划一所');
  const p = {
    id: 'p' + Date.now(), category: d.category, name: d.name, alias: d.alias, dept, publicity: d.publicity,
    leader: d.leader, members: uniq([d.leader, ...d.members]), visible: d.visible, nameImgs: d.nameImgs,
    versions: [{ no: 1, at: now(), by: me, note: '初始方案', ...d.version }],
    stageIdx: 0, stages: {}, reviews: [], deanNotes: [], log: [],
  };
  log(p, `${uname(me)} 创建项目（${d.category}）`);
  DB.projects.unshift(p); save();
  toast('✅ 已建档（送审时才通知审查人）');
  go('project', p.id);
}

function addVersion(p, v) {
  const no = p.versions.length + 1;
  p.versions.push({ no, at: now(), by: me, ...v });
  log(p, `${uname(me)} 上传第 ${no} 版方案${v.note ? '：' + v.note : ''}`, true);
  save(); closeModal(); render();
  toast(`✅ 已上传第 ${no} 版方案`);
}

function editProject(p, d) {
  const diffs = [];
  const names = (a) => a.map(uname).join('、') || '无';
  if (d.name !== p.name) diffs.push(`名称更新`);
  if (d.alias !== p.alias) diffs.push(`俗称更新`);
  const leader = d.members[0] || p.leader;
  if (leader !== p.leader) diffs.push(`负责人 → ${uname(leader)}`);
  const members = uniq([leader, ...d.members]);
  if (members.join() !== p.members.join()) diffs.push(`成员 → ${names(members)}`);
  if (d.visible.slice().sort().join() !== p.visible.slice().sort().join()) diffs.push(`公开范围更新`);
  if (!diffs.length) { closeModal(); return toast('未改动'); }
  Object.assign(p, { name: d.name, alias: d.alias, leader, members, visible: d.visible });
  log(p, `${uname(me)} 修改了项目信息（${diffs.join('、')}）`, true);
  save(); closeModal(); render();
}

function submitReview(p, d) {
  const r = {
    id: 'r' + Date.now(), stage: curStage(p), form: d.form, parallel: d.parallel, reason: d.reason,
    paper: d.paper, createdAt: now(),
    items: d.reviewers.map((uid) => ({ uid, status: 'pending', appointment: '', feedback: null, at: '' })),
  };
  p.reviews.push(r);
  log(p, `${uname(me)} 送审「${d.form}」给 ${d.reviewers.map(uname).join('、')}${d.parallel ? `（同时审查：${d.reason}）` : ''}`);
  save(); closeModal();
  notify(d.reviewers, `请审查「${p.alias || p.name}」${d.form}`);
  render();
}

function acceptReview(p, r, item, appt) {
  item.appointment = appt; item.status = 'accepted';
  log(p, `${uname(item.uid)} 接收审查${appt ? '，送册：' + fmtAppt(appt) : ''}`);
  save(); closeModal();
  if (r.paper) notify([p.leader], `${uname(item.uid)} 约你 ${fmtAppt(appt)} 送册`);
  render();
}

function submitFeedback(p, r, item, fb, alsoNotify = [], msg = '', commonIssueData = null) {
  const isEdit = item.status === 'done';
  item.feedback = fb; item.status = 'done'; item.at = now();
  log(p, `${uname(item.uid)} ${isEdit ? '修改了' : '反馈'}「${stageMeta(p, r.stage).name}」审查意见`, isEdit);

  if (commonIssueData) {
    DB.commonIssues = DB.commonIssues || [];
    DB.commonIssues.unshift(commonIssueData);
  }

  save(); closeModal(); render();
  notify([p.leader], `${uname(item.uid)} 已反馈「${p.alias || p.name}」审查意见`);
  if (alsoNotify.length) setTimeout(() => notifyOthers(p, alsoNotify, msg), 600);
}

function notifyOthers(p, uids, msg) {
  log(p, `${uname(me)} 提醒 ${uids.map(uname).join('、')} 留意审查意见`);
  save(); render();
  notify(uids, msg || `请留意「${p.alias || p.name}」审查意见`);
}

function completeStage(p, skipped = false) {
  if (!p || finished(p)) return;
  const key = curStage(p);
  const sName = stageMeta(p, key).name;
  st(p, key)[skipped ? 'skipped' : 'done'] = now();
  log(p, `${uname(me)} ${skipped ? '跳过' : '完成'}阶段「${sName}」`);
  p.stageIdx++;
  save(); render();
  toast(finished(p) ? '🎉 全部阶段已完成' : `已进入：${stageMeta(p, curStage(p)).name}`);
}

function revertStage(p) {
  if (!p || p.stageIdx <= 0) return;
  const back = path(p)[p.stageIdx - 1];
  const backName = stageMeta(p, back).name;
  p.stageIdx--;
  delete st(p, back).done;
  delete st(p, back).skipped;
  log(p, `${uname(me)} 退回阶段「${backName}」`, true);
  save(); render();
  toast(`↩ 已退回：${backName}`);
}

function saveMeeting(p, m, key) {
  key = key || curStage(p);
  const isEdit = !!(p.stages[key] || {}).meeting;
  st(p, key).meeting = m;
  log(p, `${uname(me)} ${isEdit ? '修改了' : '记录了'}「${stageMeta(p, key).name}」`, isEdit);
  save(); closeModal(); render();
}

// ===== 一键报会登记（无表单负担、不阻塞后续评审阶段）=====
function oneTapApplyMeeting(pid, key = 's2') {
  const p = P(pid);
  if (!p) return;
  const s = st(p, key);
  s.apply = {
    applicant: me,
    submittedAt: now(),
    targetLeader: 'u1',
    status: 'pending',
  };
  log(p, `${uname(me)} 一键报会「${stageMeta(p, key).name}」`);
  save(); render();
  notify(['u1'], `${uname(me)} 报会登记「${p.alias || p.name}」`);
}

function cancelApplyMeeting(pid, key = 's2') {
  const p = P(pid);
  if (!p) return;
  const s = st(p, key);
  delete s.apply;
  log(p, `${uname(me)} 取消报会登记`, true);
  save(); render();
  toast('已取消报会登记');
}

// ---- 院长排定会议时间 ----
function deanSchedule(p, d, key = 's2') {
  const s = st(p, key);
  s.apply = s.apply || { applicant: p.leader, submittedAt: now(), targetLeader: 'u1' };
  s.apply.status = 'scheduled';
  s.apply.scheduledTime = d.time;
  s.apply.location = d.location;
  s.apply.attendees = d.attendees;
  s.apply.scheduledAt = now();

  s.meeting = s.meeting || { opinion: '', implement: '', photos: [] };
  s.meeting.time = d.time;
  s.meeting.location = d.location;
  s.meeting.attendees = d.attendees;

  const sName = stageMeta(p, key).name;
  log(p, `王院长 排定「${sName}」：${fmtAppt(d.time)} · ${d.location}`);
  save(); closeModal(); render();
  const notifyList = uniq([...(d.attendees || []), p.leader, ...(p.members || [])]);
  notify(notifyList, `「${p.alias || p.name}」${sName}定于 ${fmtAppt(d.time)}（${d.location}）`);
}

function deanBatchSchedule(projectIds, d) {
  if (!projectIds || !projectIds.length) return toast('请勾选上会项目');
  if (!d.time) return toast('请选择会议时间');
  projectIds.forEach((pid) => {
    const p = P(pid);
    if (!p) return;
    const s = st(p, 's2');
    s.apply = s.apply || { applicant: p.leader, submittedAt: now(), targetLeader: 'u1' };
    s.apply.status = 'scheduled';
    s.apply.scheduledTime = d.time;
    s.apply.location = d.location;
    s.apply.attendees = d.attendees;
    s.apply.scheduledAt = now();

    s.meeting = s.meeting || { opinion: '', implement: '', photos: [] };
    s.meeting.time = d.time;
    s.meeting.location = d.location;
    s.meeting.attendees = d.attendees;

    log(p, `王院长 合并排定技术审查会：${fmtAppt(d.time)} · ${d.location}`);
  });
  save(); closeModal(); render();
  notify(d.attendees, `已排定 ${projectIds.length} 个项目技术审查会：${fmtAppt(d.time)}（${d.location}）`);
}

function deanPendingApplies() {
  const out = [];
  DB.projects.forEach((p) => {
    path(p).forEach((key) => {
      const s = p.stages[key];
      if (s && s.apply && s.apply.status === 'pending') {
        out.push({ p, key, apply: s.apply });
      }
    });
  });
  return out;
}

// ===== 院长直通车（收纳在顶部「直通车」按钮）=====
function submitDeanNote(p, d) {
  p.deanNotes = p.deanNotes || [];
  const note = {
    id: 'dn' + Date.now(),
    by: me,
    at: now(),
    urgent: !!d.urgent,
    topic: d.topic || '请示沟通',
    text: (d.text || '').trim(),
    status: 'pending',
    replyTime: '',
    replyLoc: '',
    replyMsg: '',
    seenBySender: true,
  };
  p.deanNotes.push(note);
  log(p, `${uname(me)} 直通车请示王院长（${note.topic}）`);
  save(); closeModal(); render();
  notify(['u1'], `${uname(me)} 直通车请示「${p.alias || p.name}」：${note.topic}`);
}

function deanReplyNote(p, noteId, d) {
  p.deanNotes = p.deanNotes || [];
  const n = p.deanNotes.find((x) => x.id === noteId);
  if (!n) return;
  n.status = 'replied';
  n.replyTime = d.replyTime;
  n.replyLoc = d.replyLoc || '院长办公室';
  n.replyMsg = d.replyMsg || '';
  n.repliedAt = now();
  n.seenBySender = false;
  const timeDesc = fmtAppt(d.replyTime) || '随时过来';
  save(); closeModal(); render();
  notify([n.by, p.leader], `王院长约你 ${timeDesc}（${n.replyLoc}）当面沟通`);
}

function deanPendingNotes() {
  const out = [];
  DB.projects.forEach((p) => {
    (p.deanNotes || []).forEach((n) => {
      if (n.status === 'pending') out.push({ p, note: n });
    });
  });
  return out;
}

// ===== 共性技术问题与审查新规操作 =====
function saveCommonIssue(iss) {
  DB.commonIssues = DB.commonIssues || [];
  const idx = DB.commonIssues.findIndex((x) => x.id === iss.id);
  if (idx >= 0) DB.commonIssues[idx] = iss;
  else DB.commonIssues.unshift(iss);
  save(); closeModal(); render();
  toast('✅ 已保存');
}

function broadcastCommonIssue(issueId, scope) {
  DB.commonIssues = DB.commonIssues || [];
  const iss = DB.commonIssues.find((x) => x.id === issueId);
  if (!iss) return;
  iss.broadcasted = true;
  iss.broadcastScope = scope;
  iss.broadcastAt = now();

  DB.bulletins = DB.bulletins || [];
  const existB = DB.bulletins.find((b) => b.sourceIssueId === issueId);
  const newId = existB ? existB.id : ('b_' + Date.now());
  const bData = {
    id: newId,
    sourceIssueId: issueId,
    title: iss.title,
    category: iss.category,
    dept: scope.length === DEPTS.length ? '全院三个所' : scope.join('、'),
    tag: '共性提醒',
    priority: 'high',
    publisher: '李院总',
    publishAt: now().split(' ')[0],
    summary: iss.guide || iss.problem,
    content: `${iss.problem ? iss.problem + '\n\n' : ''}把关提示：${iss.guide}`,
  };
  if (existB) Object.assign(existB, bData);
  else DB.bulletins.unshift(bData);

  // 新发布后对其他人显示红标未读
  Object.keys(DB.readBulletins || {}).forEach((uid) => {
    if (uid !== me) DB.readBulletins[uid] = (DB.readBulletins[uid] || []).filter((id) => id !== newId);
  });

  save(); closeModal(); render();
  toast(`📢 已同步至右上角「新规」`);
}

function deleteCommonIssue(issueId) {
  DB.commonIssues = (DB.commonIssues || []).filter((x) => x.id !== issueId);
  save(); render();
  toast('已移除');
}

function saveBulletin(b) {
  DB.bulletins = DB.bulletins || [];
  const idx = DB.bulletins.findIndex((x) => x.id === b.id);
  if (idx >= 0) DB.bulletins[idx] = b;
  else DB.bulletins.unshift(b);
  Object.keys(DB.readBulletins || {}).forEach((uid) => {
    if (uid !== me) DB.readBulletins[uid] = (DB.readBulletins[uid] || []).filter((id) => id !== b.id);
  });
  save(); closeModal(); render();
  toast('✅ 新规已发布');
}

function deleteBulletin(id) {
  DB.bulletins = (DB.bulletins || []).filter((x) => x.id !== id);
  save(); render();
  toast('已删除');
}

// ===== 查询辅助 =====
function myReviewTasks() {
  const out = [];
  DB.projects.forEach((p) => p.reviews.forEach((r) => r.items.forEach((it) => {
    if (it.uid === me && it.status !== 'done') out.push({ p, r, it });
  })));
  return out;
}

function searchUsers(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return [];
  return USERS.filter((u) => u.name.toLowerCase().includes(q) || (u.py && u.py.toLowerCase().includes(q)));
}

function subordinateReviewers(p) {
  if (U(me).role !== '院总') return [];
  return p.visible.filter((u) => ['校对', '组长', '所总', '所长'].includes(U(u).role));
}

function reviewerPool(p) {
  return p.visible.filter((u) => U(u).role !== '院长' && !(curStage(p) === 's1' && U(u).role === '院总'))
    .sort((a, b) => VIS_ROLES.indexOf(U(a).role) - VIS_ROLES.indexOf(U(b).role));
}

function suggestNext(p) {
  const done = p.reviews.filter((r) => r.stage === curStage(p)).flatMap((r) => r.items.map((i) => i.uid));
  const lastRole = done.length ? Math.max(...done.map((u) => VIS_ROLES.indexOf(U(u).role))) : -1;
  return reviewerPool(p).find((u) => VIS_ROLES.indexOf(U(u).role) > lastRole);
}

function deptProjects(dept) {
  return DB.projects.filter((p) => (p.dept || '规划一所') === dept);
}

function deptMeetingApplies(dept) {
  const out = [];
  deptProjects(dept).forEach((p) => {
    path(p).forEach((key) => {
      const s = p.stages[key];
      if (s && s.apply) out.push({ p, key, apply: s.apply });
    });
  });
  return out;
}

function resetDemo() {
  if (!confirm('恢复初始示例数据？')) return;
  DB = { projects: seedProjects(), commonIssues: seedCommonIssues(), bulletins: seedBulletins(), readBulletins: {} };
  save(); go('todo');
}
