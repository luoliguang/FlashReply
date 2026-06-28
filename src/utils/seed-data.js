const SEED_FLAG = '__quick_reply_seeded_v1__'

const categories = [
  { _id: 'cat_reception', name: '客户接待', icon: '🙋', level: 1, sort: 0 },
  { _id: 'cat_order',     name: '订单相关', icon: '📦', level: 1, sort: 1 },
  { _id: 'cat_aftersale', name: '售后服务', icon: '🔧', level: 1, sort: 2 },
]

const answers = [
  {
    _id: 'ans_welcome',
    title: '欢迎问候',
    categoryId: 'cat_reception',
    content: '您好！👋 欢迎光临，我是{{客服姓名}}，很高兴为您服务！请问有什么需要帮助的吗？',
    tags: ['欢迎', '开场'],
    variables: ['客服姓名'],
    imageRefs: [],
    useCount: 42,
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'ans_wait',
    title: '稍等片刻',
    categoryId: 'cat_reception',
    content: '您好，您的问题已收到，正在为您核实中，请稍等片刻～',
    tags: ['等待'],
    variables: [],
    imageRefs: [],
    useCount: 28,
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'ans_good_review',
    title: '回复好评',
    categoryId: 'cat_reception',
    content: '亲爱的{{顾客称呼}}，非常感谢您的好评！🎉 您的认可是我们最大的动力，期待下次再为您服务！',
    tags: ['好评', '感谢'],
    variables: ['顾客称呼'],
    imageRefs: [],
    useCount: 20,
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'ans_order_query',
    title: '查询订单',
    categoryId: 'cat_order',
    content: '您好，请问您的订单号是多少？我来帮您查询一下～',
    tags: ['订单', '查询'],
    variables: [],
    imageRefs: [],
    useCount: 35,
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'ans_logistics',
    title: '物流进度',
    categoryId: 'cat_order',
    content: '您好！您的订单已于 {{发货日期}} 发出，快递单号：{{快递单号}}，可在快递官网查询实时物流。如有疑问欢迎随时联系我们！',
    tags: ['物流', '快递'],
    variables: ['发货日期', '快递单号'],
    imageRefs: [],
    useCount: 18,
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'ans_refund',
    title: '退款说明',
    categoryId: 'cat_aftersale',
    content: '您好，关于退款申请（订单号：{{订单号}}），我们将在 1–3 个工作日内处理完毕，退款将原路返回到您的支付账户，请注意查收。如有疑问请随时联系我们！',
    tags: ['退款', '售后'],
    variables: ['订单号'],
    imageRefs: [],
    useCount: 15,
    updatedAt: new Date().toISOString(),
  },
]

export function seedDemoData() {
  const db = window.preload?.db
  if (!db || localStorage.getItem(SEED_FLAG)) return

  categories.forEach((cat) => db.put(cat))
  answers.forEach((ans) => db.put(ans))

  localStorage.setItem(SEED_FLAG, '1')
}
