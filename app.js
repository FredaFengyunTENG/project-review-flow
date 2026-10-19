// ===== 状态与通用工具 =====
const KEY = 'review-proto-v5';
let DB = JSON.parse(localStorage.getItem(KEY) || 'null') || { projects: seedProjects() };
if (!DB.projects.find((p) => p.id === 'p2') || !DB.projects.find((p) => p.id === 'p3')) {
  DB = { projects: seedProjects() };
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
}
let me = localStorage.getItem(KEY + '-me') || 'u10';
let route = { name: 'todo' };

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const U = (id) => USERS.find((u) => u.id === id) || { name: '?', role: '' };
const uname = (id) => U(id).name;
const P = (id) => DB.projects.find((p) => p.id === id);
const uniq = (a) => [...new Set(a)];

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { toast('⚠️ 浏览器存储已满（原型限制），请少传几张图或重置示例数据', 6000); }
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
// 项目相关的所有人（会议参会人只能从这里选）
function projectPeople(p) { return uniq([...p.members, ...p.visible]); }

function go(name, arg) { route = { name, arg }; render(); window.scrollTo(0, 0); }
function openModal(html) {
  $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden');
  const first = $('#sheet .upl'); lastUpl = first ? first.id : null; // 弹窗里默认粘贴到第一个上传框
}
function closeModal() { $('#modal').classList.add('hidden'); lastUpl = null; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// 提示条：点一下关闭；消息类提示停留更久
function toast(msg, ms = 3000) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.title = '点击关闭';
  t.onclick = () => t.remove();
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}
// edit=true 的记录在操作记录中以不同颜色显示
function log(p, text, edit = false) { p.log.push({ t: now(), text, edit }); }
// 模拟消息推送（正式版走钉钉工作通知）
function notify(uids, msg) { if (uids.length) toast(`📨 已通知 ${uids.map(uname).join('、')}：${msg}`, 7000); }

// ===== 选人小组件 =====
document.addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  const box = c.parentElement;
  if (box.dataset.single) box.querySelectorAll('.chip').forEach((x) => x !== c && x.classList.remove('on'));
  c.classList.toggle('on');
  box.dispatchEvent(new Event('change'));
});
function picked(sel) { return $$(`${sel} .chip.on`).map((c) => c.dataset.v); }
function chips(id, items, selected = [], single = false) {
  return `<div class="chips" id="${id}" ${single ? 'data-single="1"' : ''}>` +
    items.map(([v, label]) => `<span class="chip ${selected.includes(v) ? 'on' : ''}" data-v="${esc(v)}">${esc(label)}</span>`).join('') +
    '</div>';
}

// ===== 图片上传框：拍照 / 选图 / 电脑上直接粘贴截图 =====
const UPL = {};
let lastUpl = null;
function uploader(id, init = []) {
  UPL[id] = [...init];
  return `<div class="upl" id="${id}" tabindex="0" onfocus="lastUpl='${id}'" onclick="lastUpl='${id}';this.classList.add('act')" onblur="this.classList.remove('act')">
    <div class="thumbs" id="${id}_t">${thumbsHtml(id)}</div>
    <div class="upl-bar"><label class="btn sm ghost">📷 拍照/选图<input type="file" accept="image/*" multiple hidden onchange="addFiles('${id}',this.files)"></label>
    <span class="muted">💻 电脑上：点一下此框，⌘V / Ctrl+V 粘贴截图</span></div></div>`;
}
function thumbsHtml(id) {
  return UPL[id].map((f, i) => `<span class="thumb">${f.src ? `<img src="${f.src}" onclick="viewImg(this.src)">` : `<span class="noimg">📷<br>${esc(f.name)}</span>`}<i onclick="event.stopPropagation();rmImg('${id}',${i})">×</i></span>`).join('');
}
function rmImg(id, i) { UPL[id].splice(i, 1); $('#' + id + '_t').innerHTML = thumbsHtml(id); }
async function addFiles(id, files) {
  for (const f of files) if (f && f.type.startsWith('image/')) UPL[id].push({ name: f.name || '截图.png', src: await shrink(f) });
  const box = $('#' + id + '_t'); if (box) box.innerHTML = thumbsHtml(id);
}
// 原型里把图片压缩后存在浏览器；正式版存服务器
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
  const target = document.activeElement?.dataset?.upl || lastUpl; // 在名称输入框里粘贴截图也行
  if (!target || !document.getElementById(target)) return;
  const files = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile());
  if (!files.length) return;
  e.preventDefault(); addFiles(target, files); toast('✅ 已粘贴截图');
});
function imgsHtml(list = []) {
  return list.map((f) => f.src ? `<img class="mini" src="${f.src}" onclick="viewImg(this.src)">` : `<span class="tag">📷 ${esc(f.name)}</span>`).join('');
}
function viewImg(src) {
  const o = document.createElement('div'); o.className = 'imgview';
  o.innerHTML = `<img src="${src}">`; o.onclick = () => o.remove(); document.body.appendChild(o);
}

// ===== 业务动作 =====
function createProject(d) {
  const p = {
    id: 'p' + Date.now(), category: d.category, name: d.name, alias: d.alias, publicity: d.publicity,
    leader: d.leader, members: uniq([d.leader, ...d.members]), visible: d.visible, nameImgs: d.nameImgs,
    versions: [{ no: 1, at: now(), by: me, note: '初始方案', ...d.version }],
    stageIdx: 0, stages: {}, reviews: [], deanCalls: [], log: [],
  };
  log(p, `${uname(me)} 创建项目`);
  DB.projects.unshift(p); save();
  toast('✅ 项目已创建（不会通知任何人，送审时才通知审查人）', 4000);
  go('project', p.id);
}


function addVersion(p, v) {
  const no = p.versions.length + 1;
  p.versions.push({ no, at: now(), by: me, ...v });
  log(p, `${uname(me)} 上传第 ${no} 版方案：${v.note}`, true);
  save(); closeModal(); render();
}

// 修改项目信息，并把改动写进操作记录
function editProject(p, d) {
  const diffs = [];
  const names = (a) => a.map(uname).join('、') || '无';
  if (d.name !== p.name) diffs.push(`正式名称「${p.name}」→「${d.name}」`);
  if (d.alias !== p.alias) diffs.push(`俗称「${p.alias || '无'}」→「${d.alias || '无'}」`);
  if (d.leader !== p.leader) diffs.push(`负责人 ${uname(p.leader)} → ${uname(d.leader)}`);
  const members = uniq([d.leader, ...d.members]);
  if (members.join() !== p.members.join()) diffs.push(`成员 ${names(p.members)} → ${names(members)}`);
  if (d.visible.slice().sort().join() !== p.visible.slice().sort().join()) diffs.push(`公开范围 ${names(p.visible)} → ${names(d.visible)}`);
  if (!diffs.length) { closeModal(); return toast('没有改动'); }
  Object.assign(p, { name: d.name, alias: d.alias, leader: d.leader, members, visible: d.visible });
  log(p, `${uname(me)} 修改了项目信息：${diffs.join('；')}`, true);
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
  log(p, `${uname(item.uid)} 接收审查${appt ? '，送册时间：' + fmtAppt(appt) : ''}`);
  save(); closeModal();
  if (r.paper) notify([p.leader], `${uname(item.uid)} 约你 ${fmtAppt(appt)} 送册子`);
  render();
}

function submitFeedback(p, r, item, fb, alsoNotify = [], msg = '') {
  const isEdit = item.status === 'done';
  item.feedback = fb; item.status = 'done'; item.at = now();
  log(p, `${uname(item.uid)} ${isEdit ? '修改了' : '反馈'}「${STAGES[r.stage].name}」审查意见`, isEdit);
  save(); closeModal(); render();
  notify([p.leader], `${uname(item.uid)} 已${isEdit ? '修改' : '反馈'}「${p.alias || p.name}」审查意见`);
  if (alsoNotify.length) setTimeout(() => notifyOthers(p, alsoNotify, msg), 800);
}

// 专门通知：如院总把普适性问题推送给所内审查人
function notifyOthers(p, uids, msg) {
  log(p, `${uname(me)} 通知 ${uids.map(uname).join('、')} 查看审查意见${msg ? '：' + msg : ''}`);
  save(); render();
  notify(uids, msg || `请查看 ${uname(me)} 对「${p.alias || p.name}」的审查意见`);
}

function completeStage(p, skipped = false) {
  const key = curStage(p);
  if (!confirm(`确认${skipped ? '跳过' : '完成'}「${STAGES[key].name}」，进入下一阶段？\n（点错了可以用「撤回上一阶段」恢复）`)) return;
  st(p, key)[skipped ? 'skipped' : 'done'] = now();
  log(p, `${uname(me)} ${skipped ? '跳过' : '完成'}阶段「${STAGES[key].name}」`);
  p.stageIdx++; save(); render();
  toast(finished(p) ? '🎉 项目全部阶段已完成' : `进入阶段：${STAGES[curStage(p)].name}`);
}

function revertStage(p) {
  if (p.stageIdx <= 0) return;
  const back = path(p)[p.stageIdx - 1];
  if (!confirm(`撤回到「${STAGES[back].name}」？\n已填写的意见和会议信息都会保留。`)) return;
  p.stageIdx--; delete st(p, back).done; delete st(p, back).skipped;
  log(p, `${uname(me)} 撤回到阶段「${STAGES[back].name}」`, true);
  save(); render();
}

function saveMeeting(p, m, key) {
  key = key || curStage(p);
  const isEdit = !!(p.stages[key] || {}).meeting;
  st(p, key).meeting = m;
  log(p, `${uname(me)} ${isEdit ? '修改了' : '填写了'}「${STAGES[key].name}」会议信息`, isEdit);
  save(); closeModal(); render();
}

// ---- 申请报会（直报院长）----
function applyMeeting(p, d, key) {
  key = key || curStage(p);
  const s = st(p, key);
  const isEdit = !!s.apply;
  s.apply = {
    applicant: me,
    submittedAt: now(),
    targetLeader: d.targetLeader || 'u1',
    prefTime: d.prefTime || '',
    prefQuick: d.prefQuick || '',
    materials: d.materials || [],
    note: d.note || '',
    status: 'pending',
  };
  const timeDesc = d.prefQuick || fmtAppt(d.prefTime) || '尽快安排';
  log(p, `${uname(me)} ${isEdit ? '修改了' : '提交了'}「${STAGES[key].name}」报会申请（直报王院长）：期望 ${timeDesc}`, isEdit);
  save(); closeModal(); render();
  notify([d.targetLeader || 'u1'], `${uname(me)} 提交了「${p.alias || p.name}」分院技术审查会报会申请，请审批排期`);
  toast('✅ 报会申请已直报王院长！请等待排期通知。可切换到「王院长」身份模拟审批', 5000);
}

// ---- 院长审批并排定会议 ----
function deanSchedule(p, d, key) {
  key = key || curStage(p);
  const s = st(p, key);
  s.apply = s.apply || {};
  s.apply.status = 'scheduled';
  s.apply.scheduledTime = d.time;
  s.apply.location = d.location;
  s.apply.attendees = d.attendees;
  s.apply.deanOpinion = d.deanOpinion;
  s.apply.scheduledAt = now();

  // 同步写入 meeting 结构
  s.meeting = s.meeting || { opinion: '', implement: '', photos: [] };
  s.meeting.time = d.time;
  s.meeting.location = d.location;
  s.meeting.attendees = d.attendees;
  s.meeting.deanOpinion = d.deanOpinion;

  log(p, `王院长 批准并排期「${STAGES[key].name}」：${fmtAppt(d.time)}（${d.location}）${d.deanOpinion ? '，批示：' + d.deanOpinion : ''}`);
  save(); closeModal(); render();
  const notifyList = uniq([...(d.attendees || []), p.leader, ...(p.members || [])]);
  notify(notifyList, `王院长已排定「${p.alias || p.name}」${STAGES[key].name}：${fmtAppt(d.time)}（${d.location}）`);
  toast('🎉 已成功排期！系统已同步通知全体参会人员', 5000);
}

// ---- 院长驳回报会申请 ----
function deanRejectMeeting(p, reason, key) {
  key = key || curStage(p);
  const s = st(p, key);
  if (!s.apply) return;
  s.apply.status = 'rejected';
  s.apply.rejectReason = reason;
  s.apply.rejectedAt = now();
  log(p, `王院长 驳回报会申请：${reason || '请补充完善材料后重新申报'}`);
  save(); closeModal(); render();
  notify([s.apply.applicant, p.leader], `王院长驳回了「${p.alias || p.name}」报会申请：${reason || '请补充完善材料'}`);
  toast('已驳回报会申请', 4000);
}

// ---- 查询待院长审批排期的报会申请 ----
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

// 待我处理的审查
function myReviewTasks() {
  const out = [];
  DB.projects.forEach((p) => p.reviews.forEach((r) => r.items.forEach((it) => {
    if (it.uid === me && it.status !== 'done') out.push({ p, r, it });
  })));
  return out;
}

// 拼音首字母与姓名匹配
function searchUsers(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return [];
  return USERS.filter((u) => u.name.toLowerCase().includes(q) || (u.py && u.py.toLowerCase().includes(q)));
}

// 仅限院总通知所内各级审查人员（不能向上通知领导，排除院长、院总）
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

function resetDemo() {
  if (!confirm('清空所有数据并恢复示例？')) return;
  DB = { projects: seedProjects() }; save(); go('todo');
}
