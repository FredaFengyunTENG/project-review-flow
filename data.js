// ===== 基础数据（原型用的示例数据，正式版从钉钉通讯录直接读取）=====

const DEPTS = ['规划一所', '规划二所', '规划三所'];

const USERS = [
  { id: 'u1', name: '王院长', role: '院长', dept: '院领导', py: 'wyz' },
  { id: 'u2', name: '李院总', role: '院总', dept: '院领导', py: 'lyz' },
  { id: 'u3', name: '张所长', role: '所长', dept: '规划一所', py: 'zsz' },
  { id: 'u4', name: '赵所长', role: '所长', dept: '规划二所', py: 'zsz' },
  { id: 'u5', name: '陈所总', role: '所总', dept: '规划一所', py: 'csz' },
  { id: 'u6', name: '刘所总', role: '所总', dept: '规划二所', py: 'lsz' },
  { id: 'u7', name: '周组长', role: '组长', dept: '规划一所', py: 'zzz' },
  { id: 'u8', name: '吴组长', role: '组长', dept: '规划二所', py: 'wzz' },
  { id: 'u9', name: '郑校对', role: '校对', dept: '规划一所', py: 'zjd' },
  { id: 'u10', name: '孙工', role: '成员', dept: '规划一所', py: 'sg' },
  { id: 'u11', name: '钱工', role: '成员', dept: '规划二所', py: 'qg' },
  { id: 'u12', name: '冯工', role: '成员', dept: '规划三所', py: 'fg' },
  { id: 'u13', name: '卫工', role: '成员', dept: '规划三所', py: 'wg' },
  { id: 'u14', name: '蒋工', role: '成员', dept: '规划三所', py: 'jg' },
  { id: 'u15', name: '沈工', role: '成员', dept: '规划一所', py: 'sg' },
  { id: 'u16', name: '韩工', role: '成员', dept: '规划二所', py: 'hg' },
  { id: 'u17', name: '杨工', role: '成员', dept: '规划三所', py: 'yg' },
  { id: 'u18', name: '朱工', role: '成员', dept: '规划一所', py: 'zg' },
  { id: 'u19', name: '秦工', role: '成员', dept: '规划二所', py: 'qg' },
  { id: 'u20', name: '许工', role: '成员', dept: '规划三所', py: 'xg' },
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

// ===== 普适性技术问题收集板（院总专属知识沉淀）=====
function seedCommonIssues() {
  return [
    {
      id: 'iss1',
      pid: 'p1',
      pname: '某某片区局部修改 (东湖地块)',
      category: '控规修改',
      dept: '规划一所',
      createdAt: '2026-10-14 11:30',
      by: 'u2',
      title: '地下指标计算规则与用地图边界不一致',
      problem: '送审演示文件中，指标表地下商业与停车面积与用地图红线计算范围脱节，北侧道路退让未按规划局9月最新红线管理规定核减。',
      guide: '地下空间与红线退让属于院内高频审查错误。全院三个所所有控规修改类项目，在上分院审查会前必须严格按照《规划计算指引2026版》复核用地图与指标表勾稽关系。',
      broadcasted: false,
      broadcastScope: [],
      broadcastAt: '',
    },
    {
      id: 'iss2',
      pid: 'p4',
      pname: '生态科技创新城核心区控规',
      category: '控规',
      dept: '规划三所',
      createdAt: '2026-10-13 16:00',
      by: 'u2',
      title: '新型产业用地(M0)容积率弹性论证依据不足',
      problem: '成果文本中将部分工业用地转为新型产业用地并提高容积率至3.5，但缺少产业负面清单支撑，绿地率折减计算未明确上位法定依据。',
      guide: '涉及新型产业用地容积率上浮，必须严格配套产业准入与负面清单，环境影响评估需作为附件一并呈送评审会。',
      broadcasted: true,
      broadcastScope: ['规划一所', '规划二所', '规划三所'],
      broadcastAt: '2026-10-14 09:00',
    },
    {
      id: 'iss3',
      pid: 'p3',
      pname: '滨江商务区核心板块优化调整',
      category: '控规优化调整',
      dept: '规划二所',
      createdAt: '2026-10-15 10:20',
      by: 'u2',
      title: '公共绿地跨地块平衡折算未附权属协议',
      problem: '涉及沿江公共绿地贯通与邻近开发地块绿地率置换，缺少规划自然资源局及权属人前置意向说明。',
      guide: '控规优化调整涉及绿地占补平衡的，需在前置阶段核对土地权属，避免批前公示阶段引发利益主体纠纷。',
      broadcasted: false,
      broadcastScope: [],
      broadcastAt: '',
    },
  ];
}

// ===== 示例项目 =====
function seedProjects() {
  return [
    {
      id: 'p1',
      category: '控规修改',
      name: '某某片区控制性详细规划局部修改',
      alias: '东湖地块',
      dept: '规划一所',
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
      // 院长直通车小纸条
      deanNotes: [{
        id: 'dn1',
        by: 'u10',
        at: '2026-10-15 14:20',
        urgent: true,
        text: '关于东湖地块容积率调整涉及北侧相邻军事管辖区限高协调问题，规划局要求出具分院专项核准说明，恳请王院长安排时间当面指导沟通。',
        photos: [],
        status: 'pending',
        replyTime: '',
        replyLoc: '',
        replyMsg: '',
        repliedAt: '',
      }],
      log: [
        { t: '2026-10-11 16:20', text: '孙工 创建项目' },
        { t: '2026-10-12 09:30', text: '孙工 送审「演示文件」给 郑校对' },
        { t: '2026-10-13 10:20', text: '郑校对 反馈审查意见' },
        { t: '2026-10-13 18:05', text: '孙工 上传第 2 版方案', edit: true },
        { t: '2026-10-14 08:50', text: '孙工 送审「演示文件」给 周组长' },
        { t: '2026-10-15 14:20', text: '孙工 递送院长直通车小纸条（加急请示）' },
      ],
    },
    {
      id: 'p2',
      category: '控规修改',
      name: '高新区先进制造产业园控制性详细规划局部修改',
      alias: '高新产业园',
      dept: '规划一所',
      publicity: 'after',
      leader: 'u10',
      members: ['u10', 'u11'],
      visible: ['u9', 'u7', 'u5', 'u3', 'u2', 'u1'],
      nameImgs: [],
      versions: [{
        no: 1, at: '2026-10-14 10:00', by: 'u10', note: '初步方案已完成内部多轮自审并优化',
        text: '产业一期二期用地性质合并调整，工业用地容积率由 2.0 提升至 3.0', clause: '第一款',
        imgs: { a: [{ name: '总平面与地块指标.jpg', src: '' }], b: [] },
      }],
      stageIdx: 1, // 当前在 s2: 分院技术审查会，孙工已申请报会直报王院长
      stages: {
        s1: { done: '2026-10-15 17:30' },
        s2: {
          apply: {
            applicant: 'u10',
            submittedAt: '2026-10-16 10:00',
            targetLeader: 'u1',
            prefTime: '',
            prefQuick: '下周二上午 09:30',
            materials: ['初步方案汇报演示文件 (PPT/PDF)', '用地规划图与指标表', '所内自审意见落实清单'],
            note: '方案自审成熟，指标与道路红线均已核准，特直报王院长申请分院技术审查会排期。',
            status: 'pending',
          },
        },
      },
      reviews: [{
        id: 'r10', stage: 's1', form: '演示文件', paper: false, parallel: false, reason: '',
        createdAt: '2026-10-14 10:15',
        items: [
          { uid: 'u9', status: 'done', appointment: '', feedback: { quick: '已阅，无意见' }, at: '2026-10-14 14:00' },
          { uid: 'u7', status: 'done', appointment: '', feedback: { quick: '已阅，无意见' }, at: '2026-10-15 09:30' },
          { uid: 'u5', status: 'done', appointment: '', feedback: { quick: '已阅，无意见' }, at: '2026-10-15 17:00' },
        ],
      }],
      deanNotes: [],
      log: [
        { t: '2026-10-14 10:00', text: '孙工 创建项目' },
        { t: '2026-10-14 10:15', text: '孙工 送审「演示文件」' },
        { t: '2026-10-15 17:00', text: '陈所总 审查通过「演示文件」' },
        { t: '2026-10-15 17:30', text: '孙工 完成阶段「前期审理和初步方案」' },
        { t: '2026-10-16 10:00', text: '孙工 申请报会（直报王院长）：期望 下周二上午 09:30' },
      ],
    },
    {
      id: 'p3',
      category: '控规优化调整',
      name: '滨江商务区核心板块城市设计与控制性详细规划优化调整',
      alias: '滨江商务区',
      dept: '规划二所',
      publicity: 'after',
      leader: 'u11', // 钱工
      members: ['u11', 'u10'],
      visible: ['u9', 'u7', 'u5', 'u3', 'u2', 'u1'],
      nameImgs: [],
      versions: [{
        no: 1, at: '2026-10-12 09:00', by: 'u11', note: '滨江一线天际线优化与商业建筑退让自审完成',
        text: '一线地块商业建筑限高调整为 120m，滨江公共绿地贯通率提高至 100%', clause: '第二款',
        imgs: { a: [{ name: '滨江空间效果与指标表.jpg', src: '' }], b: [] },
      }],
      stageIdx: 1, // s2: 分院技术审查会，钱工已直报王院长
      stages: {
        s1: { done: '2026-10-14 16:00' },
        s2: {
          apply: {
            applicant: 'u11',
            submittedAt: '2026-10-15 09:30',
            targetLeader: 'u1',
            prefTime: '',
            prefQuick: '下周二上午 09:30',
            materials: ['初步方案汇报演示文件 (PPT/PDF)', '用地规划图与指标表', '所内自审意见落实清单'],
            note: '方案已按所总与组长意见全面修正，一线天际线及公共绿地贯通方案成熟，特直报王院长申请分院技术审查会排期。',
            status: 'pending',
          },
        },
      },
      reviews: [{
        id: 'r20', stage: 's1', form: '演示文件', paper: false, parallel: false, reason: '',
        createdAt: '2026-10-13 10:00',
        items: [
          { uid: 'u9', status: 'done', appointment: '', feedback: { quick: '已阅，无意见' }, at: '2026-10-13 15:00' },
          { uid: 'u5', status: 'done', appointment: '', feedback: { quick: '已阅，无意见' }, at: '2026-10-14 15:30' },
        ],
      }],
      deanNotes: [],
      log: [
        { t: '2026-10-12 09:00', text: '钱工 创建项目' },
        { t: '2026-10-14 16:00', text: '钱工 完成阶段「前期审理和初步方案」' },
        { t: '2026-10-15 09:30', text: '钱工 申请报会（直报王院长）：期望 下周二上午 09:30' },
      ],
    },
    {
      id: 'p4',
      category: '控规',
      name: '生态科技创新城核心区控制性详细规划',
      alias: '生态科技城',
      dept: '规划三所',
      publicity: 'after',
      leader: 'u12', // 冯工
      members: ['u12', 'u13'],
      visible: ['u9', 'u8', 'u6', 'u4', 'u2', 'u1'],
      nameImgs: [],
      versions: [{
        no: 1, at: '2026-10-10 14:00', by: 'u12', note: '评审方案文本与图纸初稿编制完成',
        text: '规划总面积 4.8 平方公里，新型产业用地(M0)占比 25%，布局生态水廊与产学研组团', clause: '',
        imgs: { a: [{ name: '土地利用规划图.jpg', src: '' }], b: [{ name: '地块指标表.jpg', src: '' }] },
      }],
      stageIdx: 2, // s3: 评审方案审查（常规审查流转至李院总）
      stages: {
        s1: { done: '2026-10-12 18:00' },
        s2: { done: '2026-10-14 16:30', meeting: { time: '2026-10-14 14:30', location: '三楼大会议室', attendees: ['u1', 'u2', 'u4', 'u6', 'u12'], opinion: '原则同意，重点深化新型产业用地配套设施与环保论证', implement: '已补充环境评估章节' } },
      },
      reviews: [{
        id: 'r40', stage: 's3', form: '评审成果（文本图纸说明书）', paper: true, parallel: false, reason: '',
        createdAt: '2026-10-15 11:00',
        items: [
          { uid: 'u2', status: 'pending', appointment: '2026-10-21 14:00', feedback: null, at: '' },
        ],
      }],
      deanNotes: [],
      log: [
        { t: '2026-10-10 14:00', text: '冯工 创建项目' },
        { t: '2026-10-14 16:30', text: '完成阶段「分院技术审查会」' },
        { t: '2026-10-15 11:00', text: '冯工 送审「评审成果（文本图纸说明书）」给 李院总（约 10-21 14:00 送册）' },
      ],
    },
    {
      id: 'p5',
      category: '控规修改',
      name: '历史文化名城中心街区保护与活化控制性详细规划局部修改',
      alias: '历史街区保护',
      dept: '规划三所',
      publicity: 'after',
      leader: 'u13', // 卫工
      members: ['u13', 'u14'],
      visible: ['u9', 'u8', 'u6', 'u4', 'u2', 'u1'],
      nameImgs: [],
      versions: [{
        no: 1, at: '2026-10-15 09:00', by: 'u13', note: '按历史街区保护规划要求调整核心保护范围建筑限高与色彩指引',
        text: '保护街区核心区建筑限高控制在 12m 以内，文保单位周边缓冲带恢复历史街巷肌理', clause: '第三款',
        imgs: { a: [{ name: '街区建筑高度控制图.jpg', src: '' }], b: [] },
      }],
      stageIdx: 2, // s3: 评审方案审查（加急同时审查！）
      stages: {
        s1: { done: '2026-10-14 17:00' },
        s2: { done: '2026-10-15 15:00', meeting: { time: '2026-10-15 14:00', location: '二楼研讨室', attendees: ['u1', 'u2', 'u13'], opinion: '加急推进评审报批', implement: '已落实' } },
      },
      reviews: [{
        id: 'r50', stage: 's3', form: '演示文件', paper: false, parallel: true, reason: '市领导后天专题调研历史街区活化，需加急出具分院技术把关意见',
        createdAt: '2026-10-16 08:30',
        items: [
          { uid: 'u2', status: 'pending', appointment: '', feedback: null, at: '' },
        ],
      }],
      deanNotes: [],
      log: [
        { t: '2026-10-15 09:00', text: '卫工 创建项目' },
        { t: '2026-10-16 08:30', text: '卫工 送审「演示文件」给 李院总（同时审查：市领导后天专题调研历史街区活化）' },
      ],
    },
  ];
}

