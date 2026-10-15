// ===== 基础数据（原型用的示例数据，正式版从钉钉通讯录直接读取）=====

const USERS = [
  { id: 'u1', name: '王院长', role: '院长', py: 'wyz' },
  { id: 'u2', name: '李院总', role: '院总', py: 'lyz' },
  { id: 'u3', name: '张所长', role: '所长', py: 'zsz' },
  { id: 'u4', name: '赵所长', role: '所长', py: 'zsz' },
  { id: 'u5', name: '陈所总', role: '所总', py: 'csz' },
  { id: 'u6', name: '刘所总', role: '所总', py: 'lsz' },
  { id: 'u7', name: '周组长', role: '组长', py: 'zzz' },
  { id: 'u8', name: '吴组长', role: '组长', py: 'wzz' },
  { id: 'u9', name: '郑校对', role: '校对', py: 'zjd' },
  { id: 'u10', name: '孙工', role: '成员', py: 'sg' },
  { id: 'u11', name: '钱工', role: '成员', py: 'qg' },
  { id: 'u12', name: '冯工', role: '成员', py: 'fg' },
  { id: 'u13', name: '卫工', role: '成员', py: 'wg' },
  { id: 'u14', name: '蒋工', role: '成员', py: 'jg' },
  { id: 'u15', name: '沈工', role: '成员', py: 'sg' },
  { id: 'u16', name: '韩工', role: '成员', py: 'hg' },
  { id: 'u17', name: '杨工', role: '成员', py: 'yg' },
  { id: 'u18', name: '朱工', role: '成员', py: 'zg' },
  { id: 'u19', name: '秦工', role: '成员', py: 'qg' },
  { id: 'u20', name: '许工', role: '成员', py: 'xg' },
];

// 「对谁公开」的分组，按顺序就是默认的审查级别（由低到高）
const VIS_ROLES = ['校对', '组长', '所总', '所长', '院总', '院长'];

const CATEGORIES = ['控规优化调整', '控规修改', '控规', '其他（待开发）'];

// 阶段模板：review = 审查节点，meeting = 会议节点
const STAGES = {
  s1: { name: '前期审理和初步方案', type: 'review', forms: ['演示文件'] },
  s2: { name: '分院技术审查会', type: 'meeting' },
  s3: { name: '评审方案审查', type: 'review', forms: ['演示文件', '评审成果（文本图纸说明书）'] },
  s4: { name: '控规方案联审会', type: 'meeting' },
  s5: { name: '批前公示', type: 'review', forms: ['批前公示文件', '修改公示文件'] },
  s6: { name: '市长会审查', type: 'review', forms: ['演示文件'], optional: true },
  s7: { name: '市政府规划联审联批会', type: 'meeting', preReview: true },
  s8: { name: '成果报批审查', type: 'review', forms: ['报批材料', '论证报告及附件', '控规成果及附件'] },
  s9: { name: '批后公告', type: 'review', forms: ['批后公告文件'] },
};

// 各类别走的阶段；publicity = 'before' | 'after' 表示公示在联审会前还是后
function stagePath(category, publicity) {
  if (category === '其他（待开发）') return [];
  if (category === '控规') return ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
  return publicity === 'before'
    ? ['s1', 's2', 's3', 's5', 's4', 's8', 's9']
    : ['s1', 's2', 's3', 's4', 's5', 's8', 's9'];
}

const BASIS = {
  '控规优化调整': '《实施办法》第十二条',
  '控规修改': '《条例》第二十一条',
};

// 法规依据具体情形：控规修改 4 种，优化调整 11 种
const CLAUSES = {
  '控规修改': [
    '第(一)款', '第(二)款', '第(三)款', '第(四)款'
  ],
  '控规优化调整': [
    '第(一)款', '第(二)款', '第(三)款', '第(四)款', '第(五)款',
    '第(六)款', '第(七)款', '第(八)款', '第(九)款', '第(十)款', '第(十一)款'
  ]
};

// ===== 示例项目 =====
function seedProjects() {
  return [{
    id: 'p1',
    category: '控规修改',
    name: '某某片区控制性详细规划局部修改',
    alias: '东湖地块',
    publicity: 'after',
    leader: 'u10',
    members: ['u10', 'u11'],
    visible: ['u9', 'u7', 'u5', 'u3', 'u2', 'u1'],
    nameImgs: [],
    // 方案版本：每次上传都带时间戳和修改说明
    versions: [{
      no: 1, at: '2026-10-11 16:20', by: 'u10', note: '初始方案',
      text: '地块用地性质由 B1 调整为 R2，容积率 2.0 → 2.5', clause: '第一款',
      imgs: { a: [{ name: '修改内容.jpg', src: '' }], b: [] },
    }, {
      no: 2, at: '2026-10-13 18:05', by: 'u10', note: '按校对意见修正指标表地下面积；北侧道路红线退让由 5m 调整为 8m（规划局意见）',
      text: '地块用地性质由 B1 调整为 R2，容积率 2.0 → 2.4', clause: '第一款',
      imgs: { a: [{ name: '修改内容-v2.jpg', src: '' }], b: [] },
    }],
    stageIdx: 0,
    stages: {},
    reviews: [{
      id: 'r1', stage: 's1', form: '演示文件', paper: false, parallel: false, reason: '',
      createdAt: '2026-10-12 09:30',
      items: [{
        uid: 'u9', status: 'done', appointment: '',
        feedback: { quick: '', dataErr: 2, textErr: 3, key: '指标表地下部分面积与用地图不一致', other: '', photos: [{ name: '批注1.jpg', src: '' }] },
        at: '2026-10-13 10:20',
      }],
    }, {
      id: 'r2', stage: 's1', form: '演示文件', paper: false, parallel: false, reason: '',
      createdAt: '2026-10-14 08:50',
      items: [{ uid: 'u7', status: 'pending', appointment: '', feedback: null, at: '' }],
    }],
    log: [
      { t: '2026-10-11 16:20', text: '孙工 创建项目' },
      { t: '2026-10-12 09:30', text: '孙工 送审「演示文件」给 郑校对' },
      { t: '2026-10-13 10:20', text: '郑校对 反馈审查意见' },
      { t: '2026-10-13 18:05', text: '孙工 上传第 2 版方案', edit: true },
      { t: '2026-10-14 08:50', text: '孙工 送审「演示文件」给 周组长' },
    ],
  }];
}

