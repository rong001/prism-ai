(function () {
  'use strict';

  const byId = id => document.getElementById(id);
  const val = id => byId(id) ? byId(id).value.trim() : '';
  const close = () => document.querySelector('#modal')?.close();
  const action = (label, name, cls = '', icon = '', id = '') => B(label, 'ops:' + name, cls, icon, id);
  const kv = (label, value) => detail(label, value);
  const wrap = body => '<div class="stack">' + body + '</div>';
  const note = text => '<p class="muted" style="font-size:12px;line-height:1.8;margin-top:12px">' + E(text) + '</p>';
  const empty = text => '<div class="notice">' + E(text) + '</div>';
  const documentText = text => '<div class="document" style="white-space:pre-wrap;line-height:1.85">' + E(text) + '</div>';
  const choose = items => items.map(x => ({ value: x.id, label: x.name || x.title }));
  const chooseText = items => items.map(x => ({ value: x, label: x }));
  const color = s => ['已批准', '已解决', '完成', '已上线', '已完成'].includes(s) ? 'green' : ['待审核', '待审批', '待办', '待处理'].includes(s) ? 'amber' : 'purple';
  const options = () => {
    if (!db.ops) db.ops = {};
    if (!db.ops.office) db.ops.office = {};
    if (!db.ops.models) db.ops.models = { strategy: 'balanced', endpoint: '', inputMillion: 12, outputMillion: 4, inputPrice: 20, outputPrice: 60, platformCost: 1200, serviceCost: 2000, savedHours: 180, hourlyCost: 80, realization: 60 };
    return db.ops;
  };
  const nextDate = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
  function numberValue(id, name, min, max, integer = false) {
    const raw = val(id), n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < min || n > max || integer && !Number.isInteger(n)) {
      throw new Error(name + '需为 ' + min + '—' + max + ' 之间的' + (integer ? '整数' : '数值'));
    }
    return n;
  }
  function record(title, type, detailText) { audit(title, type, detailText); }
  function rowActions(items) { return '<div class="actions">' + items.join('') + '</div>'; }
  function metric(label, value, sub) { return '<section class="panel"><div class="muted">' + E(label) + '</div><div class="statnumber" style="margin:12px 0">' + E(value) + '</div>' + note(sub) + '</section>'; }

  function productsPage() {
    const rows = db.products.map(p => '<tr><td><span class="flex">' + productThumb(p.id) + '<span><strong>' + E(p.name) + '</strong><span class="sub muted small">' + E(p.sku) + '</span></span></span></td><td>' + E(p.category) + '</td><td>' + M(p.price) + '</td><td>' + p.stock.toLocaleString() + '</td><td>' + p.daily + '</td><td>' + tag(p.stock / p.daily < p.lead + 7 ? '关注补货' : '库存充足', p.stock / p.daily < p.lead + 7 ? 'amber' : 'green') + '</td><td>' + action('商品详情', 'product-detail', 'text', '', p.id) + '</td></tr>');
    const total = db.products.reduce((s, p) => s + p.stock, 0);
    return head('商品资料', db.name + ' / 让内容、客服与经营使用同一份商品事实', action('查看库存计划', 'go-inventory', '', 'package')) +
      '<div class="threecol">' + metric('在售商品', db.products.length + ' 款', '包含单品与组合装') + metric('现货合计', total.toLocaleString() + ' 件', '按当前商品台账汇总') + metric('商品知识覆盖', db.products.filter(p => db.knowledge.some(k => k.id === p.source)).length + ' / ' + db.products.length, '每款商品均关联知识资料') + '</div>' +
      '<div class="section">' + panel('商品目录', table(['商品', '分类', '售价', '现货', '日均销量', '库存状态', '操作'], rows)) + '</div>';
  }
  function productDetail(id) {
    const p = product(id); if (!p) return toast('商品记录不存在');
    const k = db.knowledge.find(x => x.id === p.source);
    const related = db.projects.filter(x => x.productId === p.id);
    modal(p.name, '<div class="flex section" style="margin-bottom:20px">' + productThumb(p.id, 'large') + '<div><h3>' + E(p.name) + '</h3><p class="muted small">' + E(p.category) + ' · ' + E(p.sku) + '</p></div></div><div class="twocol">' + wrap(kv('SKU', p.sku) + kv('品类', p.category) + kv('参考售价', M(p.price))) + wrap(kv('现货 / 在途', p.stock + ' / ' + p.inbound + ' 件') + kv('日均销量', p.daily + ' 件') + kv('采购交期', p.lead + ' 天')) + '</div><div class="section">' + documentText(p.points) + '</div><div class="section">' + (k ? action('查看商品资料 · ' + k.version, 'knowledge-detail', '', 'book', k.id) : empty('商品资料待补充')) + '</div><div class="section"><h3>关联项目</h3>' + (related.map(x => '<div class="detailrow"><span>' + E(x.name) + '</span>' + tag(x.status, color(x.status)) + '</div>').join('') || note('暂未关联项目')) + '</div><div class="actions section">' + action('计算该商品补货', 'product-inventory', 'primary', 'calculator', p.id) + '</div>', true);
  }

  function forecastState(p) {
    if (!ui.opsForecast) ui.opsForecast = {};
    if (!ui.opsForecast[p.id]) ui.opsForecast[p.id] = { growth: 15, lead: p.lead, cycle: 7, safety: Math.ceil(p.daily), moq: 100, includeInbound: true };
    return ui.opsForecast[p.id];
  }
  function forecast(p, f) {
    const daily = p.daily * (1 + f.growth / 100);
    const demand = Math.ceil(daily * (f.lead + f.cycle));
    const supply = p.stock + (f.includeInbound ? p.inbound : 0);
    const gap = Math.max(0, demand + f.safety - supply);
    return { daily, demand, supply, gap, quantity: Math.ceil(gap / f.moq) * f.moq };
  }
  function readForecast() {
    const p = product(val('ops-inventory-product'));
    if (!p) throw new Error('请选择有效商品');
    const f = {
      growth: numberValue('ops-inventory-growth', '销量变化', -80, 300), lead: numberValue('ops-inventory-lead', '采购交期', 1, 90, true),
      cycle: numberValue('ops-inventory-cycle', '复核周期', 1, 60, true), safety: numberValue('ops-inventory-safety', '安全库存', 0, 1000000, true),
      moq: numberValue('ops-inventory-moq', '起订单位', 1, 10000, true), includeInbound: val('ops-inventory-inbound') === 'yes'
    };
    ui.forecastProduct = p.id; ui.opsForecast = ui.opsForecast || {}; ui.opsForecast[p.id] = f;
    return { p, f, r: forecast(p, f) };
  }
  function inventoryPage() {
    const p = product(ui.forecastProduct) || db.products[0]; ui.forecastProduct = p.id;
    const f = forecastState(p), r = forecast(p, f);
    const input = pick('ops-inventory-product', '计划商品', choose(db.products), p.id) + '<div class="twocol">' + field('ops-inventory-growth', '日均销量变化（%）', f.growth, 'number') + field('ops-inventory-lead', '采购交期（天）', f.lead, 'number') + field('ops-inventory-cycle', '库存复核周期（天）', f.cycle, 'number') + field('ops-inventory-safety', '安全库存（件）', f.safety, 'number') + field('ops-inventory-moq', '起订单位（件）', f.moq, 'number') + pick('ops-inventory-inbound', '在途到货假设', chooseText(['yes', 'no']).map(x => ({value:x.value,label:x.value==='yes'?'交期内到货，计入供给':'尚未确认，不计入供给'})), f.includeInbound ? 'yes' : 'no') + '</div><div class="actions section">' + action('重新计算', 'forecast', 'primary', 'calculator') + action('创建采购草稿', 'forecast-purchase', '', 'plus') + '</div>';
    const result = kv('当前现货', p.stock.toLocaleString() + ' 件') + kv('计入在途', (f.includeInbound ? p.inbound : 0).toLocaleString() + ' 件') + kv('调整后日均销量', r.daily.toFixed(1) + ' 件') + kv('计划覆盖区间', f.lead + f.cycle + ' 天') + kv('预计区间需求', r.demand.toLocaleString() + ' 件') + kv('净补货缺口', r.gap.toLocaleString() + ' 件') + '<div class="section"><div class="muted">建议采购</div><div class="statnumber">' + r.quantity.toLocaleString() + '<span class="muted" style="font-size:14px"> 件</span></div></div>' + note('需求 = 日均销量 × (1 + 变化率) × (交期 + 复核周期)；缺口 = 需求 + 安全库存 − 现货 − 计入在途。按起订单位向上取整。此为计划测算，未包含季节性或促销相互影响。');
    return head('库存与补货', '把销量变化、供应交期与安全库存放到同一份计划里', action('查看采购申请', 'go-procurement', '', 'arrow-right')) + '<div class="twocol">' + panel('补货参数', input) + panel('计划测算结果', result) + '</div><div class="section">' + panel('商品库存覆盖', table(['商品', '现货', '在途', '采购交期', '现货覆盖', '操作'], db.products.map(x => '<tr><td>' + E(x.name) + '</td><td>' + x.stock + '</td><td>' + x.inbound + '</td><td>' + x.lead + ' 天</td><td>' + (x.stock / x.daily).toFixed(1) + ' 天</td><td>' + action('测算', 'product-inventory', 'text', '', x.id) + '</td></tr>'))) + '</div>';
  }
  function procurementPage() {
    const pending = db.purchases.filter(p => p.status === '待审批').length;
    return head('采购协作', '从建议补货到审批与供应商下单方案', action('新建采购申请', 'purchase-new', 'primary', 'plus')) + '<div class="threecol">' + metric('待审批申请', pending + ' 笔', '核对商品、数量与供应商') + metric('已批准申请', db.purchases.filter(p => p.status === '已批准').length + ' 笔', '可继续整理供应商下单方案') + metric('已整理方案', db.purchases.filter(p => p.orderPlan).length + ' 份', '方案保存后由采购人员对外执行') + '</div><div class="section">' + panel('采购申请台账', table(['申请编号 / 商品', '数量', '供应商', '状态', '操作'], db.purchases.map(p => '<tr><td><strong>' + E(product(p.productId)?.name || '商品待核对') + '</strong><div class="small muted">' + E(p.id) + '</div></td><td>' + p.quantity + ' 件</td><td>' + E(p.supplier) + '</td><td>' + tag(p.status, color(p.status)) + (p.orderPlan ? '<div class="small muted">下单方案已整理</div>' : '') + '</td><td>' + rowActions([action('详情', 'purchase-detail', 'text', '', p.id), p.status === '待审批' ? action('批准', 'purchase-approve', '', 'check', p.id) : action('下单方案', 'purchase-plan', '', 'file-text', p.id)]) + '</td></tr>'))) + '</div>' + note('采购方案不会向供应商发送订单。采购单价、交期与实际接单结果由采购人员确认。');
  }
  function purchaseModal(id) {
    const p = db.purchases.find(x => x.id === id); if (!p) return toast('采购申请不存在');
    const goods = product(p.productId), supplier = db.suppliers.find(s => s.name === p.supplier);
    modal('采购申请详情', kv('申请编号', p.id) + kv('商品', goods?.name || '待核对') + kv('数量', p.quantity + ' 件') + kv('供应商', p.supplier) + kv('参考交期', (supplier?.lead || goods?.lead || '待确认') + ' 天') + kv('采购单价', '待采购人员确认') + kv('状态', p.status) + (p.reason ? documentText(p.reason) : '') + (p.orderPlan ? '<div class="section">' + documentText(p.orderPlan) + '</div>' : '') + '<div class="actions section">' + (p.status === '待审批' ? action('审批通过', 'purchase-approve', 'primary', 'check', p.id) : action('整理下单方案', 'purchase-plan', 'primary', 'file-text', p.id)) + '</div>', true);
  }
  function suppliersPage() {
    return head('供应商协作', '查看供应类别、交期与交付表现，支持采购选择', action('比较供应商', 'supplier-compare-open', '', 'arrows-exchange')) + panel('供应商目录', table(['供应商', '供应类别', '参考交期', '准时交付率', '关联申请', '操作'], db.suppliers.map(s => '<tr><td><strong>' + E(s.name) + '</strong></td><td>' + E(s.category) + '</td><td>' + s.lead + ' 天</td><td>' + s.rate + '%</td><td>' + db.purchases.filter(p => p.supplier === s.name).length + ' 笔</td><td>' + action('供应商详情', 'supplier-detail', 'text', '', s.id) + '</td></tr>'))) + note('参考交期与交付率来自供应商台账。具体订单以采购人员确认的承诺为准。');
  }

  function demandsPage() {
    const sorted = db.demands.slice().sort((a,b) => b.value/b.effort-a.value/a.effort || b.value-a.value);
    return head('需求优先级', '按业务价值与实施工作量安排应用建设顺序', action('登记新需求', 'demand-new', 'primary', 'plus')) + panel('业务需求池', table(['需求 / 部门', '业务价值', '工作量', '优先级分值', '负责人', '状态', '操作'], sorted.map(x => '<tr><td><strong>' + E(x.name) + '</strong><div class="small muted">' + E(x.department) + '</div></td><td>' + x.value + ' / 5</td><td>' + x.effort + ' / 5</td><td><strong>' + (x.value/x.effort).toFixed(2) + '</strong></td><td>' + E(x.owner) + '</td><td>' + tag(x.status,color(x.status)) + '</td><td>' + action('评估详情', 'demand-detail', 'text', '', x.id) + '</td></tr>'))) + note('优先级分值 = 业务价值 ÷ 实施工作量。该分值辅助排序，资料质量、依赖关系与权限条件仍需在立项前核对。');
  }
  function demandForm(item) {
    return field('ops-demand-name','需求名称',item?.name || '') + '<div class="twocol">' + pick('ops-demand-department','业务部门',chooseText(['增长运营','内容中心','客户服务','商品供应','财务行政','技术平台']),item?.department || '增长运营') + pick('ops-demand-owner','负责人',chooseText(db.members.map(m=>m.name)),item?.owner || db.members[0].name) + field('ops-demand-value','业务价值（1—5）',item?.value || 4,'number') + field('ops-demand-effort','工作量（1—5）',item?.effort || 3,'number') + pick('ops-demand-status','状态',chooseText(['待评估','待排期','推进中','已上线','暂缓']),item?.status || '待评估') + '</div><div class="actions section">' + action(item?'保存评估':'保存需求','demand-save','primary','check',item?.id || '') + '</div>';
  }

  function officeTabs(tab) {
    return '<div class="actions section" style="margin-bottom:20px">' + [['hr','HR 面试准备'],['finance','财务票据初审'],['admin','行政行动项']].map(([id,label]) => action(label,'office-tab',tab===id?'primary':'','',id)).join('') + '</div>';
  }
  function officePage() {
    options(); ui.tab = ui.tab || {}; const tab = ui.tab.office || 'hr', out = db.ops.office[tab];
    let form = '', description = '';
    if (tab === 'hr') {
      description = '把岗位要求与候选人摘要整理为可追问的面试提纲';
      form = field('ops-hr-role','岗位要求',out?.input?.role || 'AI 应用工程师：负责 RAG 知识问答、API 集成、内容工作流、质量评测与成本优化；能与业务团队协作。','textarea') + field('ops-hr-candidate','候选人工作摘要',out?.input?.candidate || '曾参与商品知识问答项目，使用 RAG 和 API 接入客服工具；负责内容资料整理与上线协作。希望进一步了解其评测方法、成本分析和故障处理经验。','textarea') + action('整理面试提纲','office-hr','primary','file-text') + note('仅提取输入中提及的信息并生成追问提纲，不据此给出录用结论或推断个人属性。');
    } else if (tab === 'finance') {
      description = '检查票据编号、金额与凭证状态，先找出需要人工核对的记录';
      form = field('ops-finance-lines','每行：单据编号,费用项目,金额,凭证状态',out?.input?.lines || 'BX-1001,差旅交通,186.50,有\nBX-1002,办公用品,328.00,有\nBX-1003,渠道素材,1200.00,有\nBX-1004,差旅住宿,568.00,缺失\nBX-1002,办公用品,328.00,有\nBX-1005,会议用品,249.00,有','textarea') + action('执行票据校验','office-finance','primary','calculator') + note('校验范围为输入格式、编号重复、正金额和凭证字段；税务真伪及报销政策由财务人员核验。');
    } else {
      description = '将会议决定整理为负责人明确、截止日期清晰的待办草稿';
      form = field('ops-admin-notes','每行一项：行动事项｜负责人：姓名｜截止：YYYY-MM-DD',out?.input?.notes || '确认商品使用资料｜负责人：' + db.members[3].name + '｜截止：2026-10-03\n完成首批内容审核｜负责人：' + db.members[1].name + '｜截止：2026-10-04\n整理投放复盘指标｜负责人：' + db.members[0].name + '｜截止：2026-10-06','textarea') + pick('ops-admin-project','关联业务项目',choose(db.projects),out?.projectId || db.projects[0].id) + action('整理行动项','office-admin','primary','file-text') + note('缺少负责人或日期时会标记为待补充，补齐后再加入工作待办。');
    }
    let output = out ? documentText(out.text) : empty('填写左侧资料，结果会保存在当前工作空间。');
    if (out) output += '<div class="actions section">' + action('导出结果','office-export','','download',tab) + (tab==='admin' ? action(out.added?'已加入待办':'加入工作待办','office-admin-tasks',out.added?'':'primary','plus') : '') + '</div>';
    return head('职能助手',description) + officeTabs(tab) + '<div class="twocol">' + panel('任务资料',form) + panel(tab==='hr'?'面试准备稿':tab==='finance'?'票据校验结果':'会议行动项',output) + '</div>';
  }

  function teamPage() {
    const avg = db.members.reduce((s,m)=>s+m.adoption,0)/db.members.length;
    return head('团队与应用使用', '查看各业务角色的使用情况，找到培训与流程改善的入口') + '<div class="threecol">' + metric('业务成员',db.members.length + ' 人','覆盖增长、内容、客服、商品与职能') + metric('平均应用使用率',avg.toFixed(1)+'%','按成员台账中的使用率取平均') + metric('高活跃成员',db.members.filter(m=>m.adoption>=90).length+' 人','应用使用率达到 90%') + '</div><div class="section">' + panel('成员应用台账',table(['成员','角色 / 部门','常用应用','应用使用率','操作'],db.members.map((m,i)=>'<tr><td><strong>'+E(m.name)+'</strong></td><td>'+E(m.role)+'<div class="small muted">'+E(m.department)+'</div></td><td>'+m.apps.map(a=>tag(a,'')).join(' ')+'</td><td><strong>'+m.adoption+'%</strong><div class="progress" style="margin-top:8px"><span style="display:block;width:'+m.adoption+'%;height:4px;background:var(--accent,#8b79ed)"></span></div></td><td>'+action('使用详情','member-detail','text','',String(i))+'</td></tr>')))+'</div>';
  }
  function modelEstimate(c) {
    const usage=c.inputMillion*c.inputPrice+c.outputMillion*c.outputPrice;
    const total=usage+c.platformCost+c.serviceCost;
    const capacity=c.savedHours*c.hourlyCost;
    const realized=capacity*c.realization/100;
    return {usage,total,capacity,realized,net:realized-total};
  }
  function modelsPage() {
    const c=options().models,r=modelEstimate(c);
    const settings=pick('ops-model-strategy','任务路由策略',[{value:'balanced',label:'均衡：内容质量与预算兼顾'},{value:'quality',label:'质量优先：高要求内容优先主路由'},{value:'cost',label:'成本优先：分类与整理优先轻量路由'}],c.strategy)+field('ops-model-endpoint','企业模型网关地址',c.endpoint,'url')+note('接入状态：待配置。当前设置保存路由偏好与预算参数；网关鉴权、模型调用与线上监控需完成服务端连接。页面不会保存密钥。')+action('保存路由设置','model-route-save','primary','check');
    const fields='<div class="twocol">'+field('ops-model-input','月输入量（百万 token）',c.inputMillion,'number')+field('ops-model-output','月输出量（百万 token）',c.outputMillion,'number')+field('ops-model-input-price','输入单价（元 / 百万 token）',c.inputPrice,'number')+field('ops-model-output-price','输出单价（元 / 百万 token）',c.outputPrice,'number')+field('ops-model-platform','平台月成本（元）',c.platformCost,'number')+field('ops-model-service','维护与支持月成本（元）',c.serviceCost,'number')+field('ops-model-hours','释放工时（小时 / 月）',c.savedHours,'number')+field('ops-model-hourly','综合人工成本（元 / 小时）',c.hourlyCost,'number')+field('ops-model-realization','产能价值实现比例（%）',c.realization,'number')+'</div>'+action('保存并计算','model-calculate','primary','calculator')+note('价格、用量与工时均为可调整预算参数，请按采购合同及业务测量值更新。');
    return head('模型与价值管理','把任务路由、运行成本与业务收益放在可复核的口径下')+'<div class="threecol">'+metric('预计月运行成本',M(r.total),'模型用量费用 + 平台 + 维护支持')+metric('可实现产能价值',M(r.realized),'释放工时 × 人工成本 × 实现比例')+metric('估算净产能价值',M(r.net),'可实现产能价值 − 月运行成本')+'</div><div class="twocol section">'+panel('任务路由配置',settings)+panel('收益口径',kv('模型预算费用',M(r.usage))+kv('全部释放产能价值',M(r.capacity))+kv('价值实现比例',c.realization+'%')+kv('已连接模型服务','待配置')+note('产能价值并不等于已经减少的现金支出。新增收入、现金成本和释放工时需分别跟踪，避免重复计算。'))+'</div><div class="section">'+panel('月度预算与产能测算',fields)+'</div>';
  }

  function knowledgePage() {
    const q=(ui.opsKnowledgeQuery||'').toLowerCase(), category=ui.opsKnowledgeCategory||'全部分类';
    const list=db.knowledge.filter(k=>(category==='全部分类'||k.category===category)&&(!q||(k.title+' '+k.text).toLowerCase().includes(q)));
    const filters='<div class="twocol">'+field('ops-knowledge-search','搜索标题或资料内容',ui.opsKnowledgeQuery||'')+pick('ops-knowledge-category','知识分类',chooseText(['全部分类',...new Set(db.knowledge.map(k=>k.category))]),category)+'</div><div class="actions">'+action('搜索资料','knowledge-search','primary','search')+action('清除筛选','knowledge-clear')+'</div>';
    const cards=list.map(k=>'<section class="panel"><div class="panelhead"><h3>'+E(k.title)+'</h3>'+tag(k.version,'purple')+'</div><div>'+tag(k.category,'')+'</div><p style="line-height:1.85;margin:14px 0">'+E(k.text.slice(0,110))+'…</p>'+action('阅读全文','knowledge-detail','text','book',k.id)+'</section>').join('');
    return head('知识中心',db.name+' / 商品资料、活动规则与品牌表达规范')+panel('知识检索',filters)+'<div class="twocol section">'+(cards||empty('未找到符合条件的资料，请调整关键词或分类。'))+'</div>';
  }
  function knowledgeDetail(id) {
    const k=db.knowledge.find(x=>x.id===id); if(!k)return toast('知识资料不存在');
    modal(k.title,'<div class="actions">'+tag(k.category,'')+tag(k.version,'purple')+'</div><div class="section">'+documentText(k.text)+'</div>'+note('资料编号：'+k.id)+'<div class="actions section">'+action('导出资料','knowledge-export','','download',k.id)+'</div>',true);
  }
  function automationsPage() {
    return head('工作自动化','按既定条件整理任务与草稿，保留每次执行记录')+'<div class="stack">'+db.automations.map(a=>panel(a.name,kv('触发条件',a.trigger)+kv('执行动作',a.action)+kv('运行次数',a.runs+' 次')+kv('最近执行',a.lastRun||'尚未记录执行时间')+'<div class="actions section">'+action(a.enabled?'停用流程':'启用流程','automation-toggle',a.enabled?'':'primary','',a.id)+action('执行一次','automation-run','','play',a.id),tag(a.enabled?'已启用':'已停用',a.enabled?'green':''))).join('')+'</div>'+note('执行会在当前工作空间生成待办或采购草稿。定时触发服务待配置；这里的启用状态保存工作流偏好，不代表后台已运行定时任务。');
  }
  function auditPage() {
    const q=(ui.opsAuditQuery||'').toLowerCase();
    const logs=db.logs.filter(l=>!q||(l.title+' '+l.type+' '+l.detail).toLowerCase().includes(q));
    const filter='<div class="actions">'+field('ops-audit-search','搜索操作记录',ui.opsAuditQuery||'')+action('搜索','audit-search','','search')+'</div>';
    return head('工作记录','查看业务操作、工作待办与采购审批过程',action('导出工作记录','audit-export','','download'))+panel('操作日志',filter+table(['时间','操作','业务类型','详细信息'],logs.map(l=>'<tr><td>'+E(l.time)+'</td><td><strong>'+E(l.title)+'</strong></td><td>'+tag(l.type,'')+'</td><td>'+E(l.detail)+'</td></tr>'))+(logs.length?'':empty('没有符合关键词的记录。')))+'<div class="twocol section">'+panel('工作待办',table(['事项 / 负责人','截止日期','状态','操作'],db.tasks.map(t=>'<tr><td>'+E(t.name)+'<div class="small muted">'+E(t.owner)+'</div></td><td>'+E(t.due)+'</td><td>'+tag(t.status,color(t.status))+'</td><td>'+action(t.status==='完成'?'重新打开':'标记完成','task-toggle','text','',t.id)+'</td></tr>')))+panel('采购记录',table(['申请','数量','状态'],db.purchases.map(p=>'<tr><td>'+E(product(p.productId)?.name||p.productId)+'</td><td>'+p.quantity+' 件</td><td>'+tag(p.status,color(p.status))+'</td></tr>')))+ '</div>';
  }

  function hrDraft() {
    const role=val('ops-hr-role'),candidate=val('ops-hr-candidate');
    if(!role||!candidate)throw new Error('请补充岗位要求和候选人工作摘要');
    const words=['RAG','Agent','API','SQL','内容','客服','评测','成本','协作','项目'];
    const required=words.filter(w=>role.toLowerCase().includes(w.toLowerCase()));
    const mentioned=required.filter(w=>candidate.toLowerCase().includes(w.toLowerCase()));
    const gaps=required.filter(w=>!candidate.toLowerCase().includes(w.toLowerCase()));
    const text='面试准备提纲\n\n摘要中提及：'+(mentioned.join('、')||'尚未匹配到岗位关键词')+'\n待补充核对：'+(gaps.join('、')||'请继续核对工作范围、结果与本人贡献')+'\n\n建议追问\n1. 选一个与本岗位相关的项目，说明业务问题、使用者和交付边界。\n2. 你本人具体负责哪部分？可以提供什么资料来核对？\n3. 如何收集商品与业务知识，处理更新和相互冲突的信息？\n4. 如何设计检索、内容或接口任务的质量评测？\n5. 遇到错误回答、调用失败或重复提交时如何处理？\n6. 你用哪些指标衡量人工处理时间、调用成本和业务效果？\n7. 上线前怎样组织业务验收，出现问题如何回退？\n8. 如果预算和时间受限，第一阶段会保留哪些能力？\n\n记录方式：逐项记下候选人的具体证据、尚未验证的信息和后续追问。关键词出现仅表示摘要提及，不代表已经具备相应能力。';
    options().office.hr={text,input:{role,candidate},createdAt:new Date().toISOString()};record('整理面试准备提纲','职能助手','已保存岗位与工作摘要对应的追问草稿');render();
  }
  function financeDraft() {
    const lines=val('ops-finance-lines');if(!lines)throw new Error('请填写需要校验的票据记录');
    const seen=new Set(),valid=[],issues=[];let total=0;
    const rows=lines.split(/\r?\n/).filter(x=>x.trim());
    rows.forEach((line,i)=>{
      const cols=line.split(/[,，\t]/).map(x=>x.trim());
      if(cols.length!==4){issues.push('第 '+(i+1)+' 行：字段数量不正确，应为 4 列。');return;}
      const [id,type,amount,proof]=cols,n=Number(amount),reasons=[];
      if(!id||!type)reasons.push('编号或费用项目缺失');
      if(seen.has(id))reasons.push('单据编号重复');
      if(id)seen.add(id);
      if(!amount||!Number.isFinite(n)||n<=0)reasons.push('金额需为正数');
      if(!['有','齐全','已上传'].includes(proof))reasons.push('凭证待补充');
      if(reasons.length)issues.push(id+'：'+reasons.join('；'));
      else{valid.push(id+' · '+type+' · '+M(n));total+=n;}
    });
    const text='票据初审结果\n\n输入记录：'+rows.length+' 条\n基础校验通过：'+valid.length+' 条\n需人工核对：'+issues.length+' 条\n通过记录金额合计：'+M(total)+'\n\n通过记录\n'+(valid.join('\n')||'暂无')+'\n\n待核对事项\n'+(issues.join('\n')||'本次未发现格式、重复或缺证问题')+'\n\n通过表示完成字段检查，不表示票据真实有效或符合全部报销要求；应由财务人员继续核对。';
    options().office.finance={text,input:{lines},createdAt:new Date().toISOString()};record('完成票据基础校验','职能助手',rows.length+' 条记录，'+issues.length+' 条需核对');render();
  }
  function adminDraft() {
    const notes=val('ops-admin-notes'),projectId=val('ops-admin-project');if(!notes)throw new Error('请填写会议行动事项');if(!project(projectId))throw new Error('请选择有效项目');
    const items=notes.split(/\r?\n/).filter(x=>x.trim()).map(line=>{
      const parts=line.split(/[|｜]/).map(x=>x.trim()),ownerPart=parts.find(x=>/^负责人[：:]/.test(x)),duePart=parts.find(x=>/^截止[：:]/.test(x));
      const owner=ownerPart?ownerPart.replace(/^负责人[：:]\s*/,''):'',due=duePart?duePart.replace(/^截止[：:]\s*/,''):'';
      const validDate=/^\d{4}-\d{2}-\d{2}$/.test(due)&&!Number.isNaN(new Date(due).getTime())&&new Date(due).toISOString().slice(0,10)===due;
      return {name:parts[0],owner,due,valid:!!parts[0]&&db.members.some(m=>m.name===owner)&&validDate};
    });
    const text='会议行动项草稿\n\n关联项目：'+project(projectId).name+'\n\n'+items.map((x,i)=>(i+1)+'. '+x.name+'\n负责人：'+(x.owner||'待补充')+'\n截止：'+(x.due||'待补充')+'\n校验：'+(x.valid?'资料完整，可加入待办':'请确认负责人属于当前团队，并补齐有效日期')).join('\n\n');
    options().office.admin={text,input:{notes},items,projectId,added:false,createdAt:new Date().toISOString()};record('整理会议行动项','职能助手',items.length+' 项行动草稿');render();
  }
  function createPurchase(p,quantity,supplier,reason) {
    const purchase={id:uid(db.id+'-purchase'),productId:p.id,quantity,status:'待审批',supplier,reason};
    db.purchases.unshift(purchase);return purchase;
  }
  function createTask(name,owner,projectId,extra) {
    const task={id:uid(db.id+'-task'),name,owner,due:nextDate(),status:'待办',projectId,...extra};db.tasks.unshift(task);return task;
  }
  function runAutomation(id) {
    const a=db.automations.find(x=>x.id===id);if(!a)throw new Error('工作流不存在');if(!a.enabled)throw new Error('请先启用该工作流');
    if(db.tasks.some(t=>t.automationId===id&&t.status==='待办'))return toast('已有该流程生成的待办，请先处理后再执行');
    let detailText='';const index=db.automations.indexOf(a);
    if(index===1){
      const p=db.products.find(x=>x.stock/x.daily<x.lead+7)||db.products[0],f={growth:0,lead:p.lead,cycle:7,safety:p.daily,moq:100,includeInbound:true},r=forecast(p,f);
      if(r.quantity>0){
        const existing=db.purchases.find(x=>x.productId===p.id&&x.status==='待审批');
        if(existing)detailText='关联已有采购草稿 '+existing.id+'，请复核数量与在途到货';
        else{const supplier=db.suppliers.find(s=>s.category===p.category)||db.suppliers[0],purchase=createPurchase(p,r.quantity,supplier.name,'按库存覆盖条件生成，请复核销量及在途到货。');detailText='已保存采购草稿 '+purchase.id+'，建议 '+r.quantity+' 件';}
      }else detailText='当前可用库存覆盖计划需求，已生成库存复核待办';
      createTask('库存复核草稿 · '+p.name,db.members[3].name,db.projects.find(x=>x.productId===p.id)?.id||db.projects[0].id,{automationId:id});
    }else if(index===0){const count=db.assets.filter(x=>x.status==='review').length;createTask('内容审阅草稿 · '+count+' 份待审核素材',db.members[1].name,db.projects.find(x=>x.status==='待审核')?.id||db.projects[0].id,{automationId:id});detailText='已保存 '+count+' 份素材的审阅待办草稿';}
    else{createTask('资料复核草稿 · 活动与商品知识',db.members[5].name,db.projects[0].id,{automationId:id});detailText='已保存知识资料和关联素材的复核待办草稿';}
    a.runs+=1;a.lastRun=new Date().toLocaleString('zh-CN');record('执行工作流 · '+a.name,'工作自动化',detailText);toast(detailText);render();
  }

  window.ExtraPages={...(window.ExtraPages||{}),products:productsPage,inventory:inventoryPage,procurement:procurementPage,suppliers:suppliersPage,demands:demandsPage,office:officePage,team:teamPage,models:modelsPage,knowledge:knowledgePage,automations:automationsPage,audit:auditPage};
  window.extraAction=function(name,el){
    if(!name.startsWith('ops:'))return false;
    const a=name.slice(4),id=el?.dataset?.id||'';
    try{
      if(a==='go-inventory'){close();go('inventory');}
      else if(a==='go-procurement'){close();go('procurement');}
      else if(a==='product-detail')productDetail(id);
      else if(a==='product-inventory'){ui.forecastProduct=id;close();go('inventory');}
      else if(a==='forecast'){readForecast();render();toast('补货计划已更新');}
      else if(a==='forecast-purchase'){
        const {p,f,r}=readForecast();if(!r.quantity)throw new Error('当前参数下无需补货，可调整参数后重新计算');
        const supplier=db.suppliers.find(s=>s.category===p.category)||db.suppliers[0];
        const duplicate=db.purchases.find(x=>x.productId===p.id&&x.quantity===r.quantity&&x.status==='待审批');
        if(duplicate){purchaseModal(duplicate.id);toast('已有相同商品与数量的待审批草稿');return true;}
        const pch=createPurchase(p,r.quantity,supplier.name,'计划需求 '+r.demand+' 件，安全库存 '+f.safety+' 件，计入供给 '+r.supply+' 件；按 '+f.moq+' 件起订单位取整。');
        record('创建采购申请草稿','商品经营',p.name+' · '+r.quantity+' 件 · '+pch.id);purchaseModal(pch.id);toast('采购草稿已保存');
      }
      else if(a==='purchase-new')modal('新建采购申请',pick('ops-purchase-product','采购商品',choose(db.products),db.products[0].id)+field('ops-purchase-quantity','申请数量（件）',100,'number')+pick('ops-purchase-supplier','供应商',chooseText(db.suppliers.map(s=>s.name)),db.suppliers[0].name)+field('ops-purchase-reason','申请原因','','textarea')+'<div class="actions section">'+action('保存申请草稿','purchase-save','primary','check')+'</div>');
      else if(a==='purchase-save'){
        const p=product(val('ops-purchase-product')),supplier=val('ops-purchase-supplier'),quantity=numberValue('ops-purchase-quantity','申请数量',1,1000000,true);
        if(!p||!db.suppliers.some(s=>s.name===supplier))throw new Error('请核对商品和供应商');
        const draft=createPurchase(p,quantity,supplier,val('ops-purchase-reason')||'人工登记采购申请');record('新建采购申请','商品经营',p.name+' · '+quantity+' 件 · '+draft.id);close();render();toast('采购申请已保存');
      }
      else if(a==='purchase-detail')purchaseModal(id);
      else if(a==='purchase-approve'){
        const p=db.purchases.find(x=>x.id===id);if(!p)throw new Error('采购申请不存在');if(p.status!=='待审批')throw new Error('该申请已完成审批');
        p.status='已批准';p.approvedAt=new Date().toISOString();record('采购申请审批通过','采购审批',p.id+' · '+p.quantity+' 件');close();render();toast('审批已保存，可继续整理下单方案');
      }
      else if(a==='purchase-plan'){
        const p=db.purchases.find(x=>x.id===id);if(!p)throw new Error('采购申请不存在');if(p.status==='待审批')throw new Error('请先完成采购审批');
        const s=db.suppliers.find(x=>x.name===p.supplier),goods=product(p.productId);
        p.orderPlan='供应商下单方案\n申请：'+p.id+'\n商品：'+goods.name+'\nSKU：'+goods.sku+'\n数量：'+p.quantity+' 件\n供应商：'+p.supplier+'\n参考交期：'+(s?.lead||goods.lead)+' 天\n采购单价、到货日期与付款安排：待采购人员确认\n\n执行前核对商品规格、供应商报价、交期承诺和收货信息；本方案仅保存工作资料，尚未对外发送订单。';
        record('整理供应商下单方案','采购协作',p.id+' · 方案已保存');modal('供应商下单方案',documentText(p.orderPlan)+'<div class="actions section">'+action('下载方案','purchase-export','','download',p.id)+'</div>',true);
      }
      else if(a==='purchase-export'){const p=db.purchases.find(x=>x.id===id);if(!p?.orderPlan)throw new Error('请先整理下单方案');download(p.id+'-下单方案.txt',p.orderPlan,'text/plain;charset=utf-8');}
      else if(a==='supplier-detail'){
        const s=db.suppliers.find(x=>x.id===id);if(!s)throw new Error('供应商不存在');const related=db.purchases.filter(p=>p.supplier===s.name);
        modal(s.name,kv('供应商编号',s.id)+kv('供应类别',s.category)+kv('参考交期',s.lead+' 天')+kv('准时交付率',s.rate+'%')+kv('关联采购申请',related.length+' 笔')+documentText(related.map(p=>(product(p.productId)?.name||p.productId)+' · '+p.quantity+' 件 · '+p.status).join('\n')||'暂无关联采购申请'),true);
      }
      else if(a==='supplier-compare-open')modal('供应商比较',pick('ops-supplier-a','供应商 A',choose(db.suppliers),db.suppliers[0].id)+pick('ops-supplier-b','供应商 B',choose(db.suppliers),db.suppliers[1].id)+'<div class="actions section">'+action('比较记录','supplier-compare','primary','arrows-exchange')+'</div>');
      else if(a==='supplier-compare'){
        const s1=db.suppliers.find(s=>s.id===val('ops-supplier-a')),s2=db.suppliers.find(s=>s.id===val('ops-supplier-b'));if(!s1||!s2||s1.id===s2.id)throw new Error('请选择两家不同供应商');
        modal('供应商比较',table(['维度',s1.name,s2.name],[['供应类别',s1.category,s2.category],['参考交期',s1.lead+' 天',s2.lead+' 天'],['准时交付率',s1.rate+'%',s2.rate+'%'],['关联申请',db.purchases.filter(p=>p.supplier===s1.name).length+' 笔',db.purchases.filter(p=>p.supplier===s2.name).length+' 笔']].map(row=>'<tr>'+row.map(x=>'<td>'+E(x)+'</td>').join('')+'</tr>'))+note(s1.category===s2.category?'可继续结合报价、产能与质量资料判断。':'两家供应类别不同，请先确认商品供应适配性，不能只按交期或交付率直接替换。'),true);
      }
      else if(a==='demand-new')modal('登记业务需求',demandForm());
      else if(a==='demand-detail'){const item=db.demands.find(x=>x.id===id);if(!item)throw new Error('需求不存在');modal('需求评估',demandForm(item));}
      else if(a==='demand-save'){
        const item={name:val('ops-demand-name'),department:val('ops-demand-department'),owner:val('ops-demand-owner'),value:numberValue('ops-demand-value','业务价值',1,5,true),effort:numberValue('ops-demand-effort','实施工作量',1,5,true),status:val('ops-demand-status')};
        if(!item.name)throw new Error('请填写需求名称');if(!db.members.some(m=>m.name===item.owner))throw new Error('请选择有效负责人');
        const existing=db.demands.find(x=>x.id===id);if(existing)Object.assign(existing,item);else db.demands.unshift({id:uid(db.id+'-demand'),...item});
        record(existing?'更新需求评估':'登记业务需求','需求管理',item.name+' · 优先级 '+(item.value/item.effort).toFixed(2));close();render();toast('需求已保存');
      }
      else if(a==='office-tab'){ui.tab=ui.tab||{};ui.tab.office=id;render();}
      else if(a==='office-hr')hrDraft();
      else if(a==='office-finance')financeDraft();
      else if(a==='office-admin')adminDraft();
      else if(a==='office-export'){const out=options().office[id];if(!out)throw new Error('请先生成结果');download(db.name+'-'+({hr:'面试提纲',finance:'票据初审',admin:'会议行动项'}[id]||'工作资料')+'.txt',out.text,'text/plain;charset=utf-8');}
      else if(a==='office-admin-tasks'){
        const out=options().office.admin;if(!out)throw new Error('请先整理行动项');if(out.added)return toast('这些行动项已经加入待办');if(out.items.some(x=>!x.valid))throw new Error('请先补齐全部行动项的团队负责人和有效截止日期');
        out.items.forEach(x=>createTask(x.name,x.owner,out.projectId,{due:x.due}));out.added=true;record('会议行动项加入待办','职能助手',out.items.length+' 项 · '+project(out.projectId).name);render();toast('行动项已加入工作待办');
      }
      else if(a==='member-detail'){
        const m=db.members[Number(id)];if(!m)throw new Error('成员记录不存在');const tasks=db.tasks.filter(t=>t.owner===m.name),projects=db.projects.filter(p=>p.owner===m.name);
        modal(m.name+' · 应用使用',kv('角色',m.role)+kv('部门',m.department)+kv('应用使用率',m.adoption+'%')+kv('常用应用',m.apps.join('、'))+kv('负责业务项目',projects.length+' 个')+kv('未完成待办',tasks.filter(t=>t.status==='待办').length+' 项')+documentText(projects.map(p=>p.name+' · '+p.status).join('\n')||'当前未分配业务项目')+note(m.adoption<85?'建议结合日常工作找到一个高频场景，安排一次操作练习并跟进使用反馈。':'可邀请该成员分享常用流程，帮助同岗位同事熟悉应用。'),true);
      }
      else if(a==='model-route-save'){
        const c=options().models,endpoint=val('ops-model-endpoint');if(endpoint&&!/^https?:\/\//i.test(endpoint))throw new Error('网关地址需以 http:// 或 https:// 开头');c.strategy=val('ops-model-strategy');c.endpoint=endpoint;record('保存模型路由偏好','AI 治理',c.strategy+' · 服务连接待配置');toast('路由设置已保存');render();
      }
      else if(a==='model-calculate'){
        const c=options().models,fields=[['inputMillion','ops-model-input','月输入量',100000],['outputMillion','ops-model-output','月输出量',100000],['inputPrice','ops-model-input-price','输入单价',100000],['outputPrice','ops-model-output-price','输出单价',100000],['platformCost','ops-model-platform','平台成本',10000000],['serviceCost','ops-model-service','维护成本',10000000],['savedHours','ops-model-hours','释放工时',1000000],['hourlyCost','ops-model-hourly','人工成本',100000],['realization','ops-model-realization','实现比例',100]];
        const patch={};fields.forEach(([key,input,label,max])=>patch[key]=numberValue(input,label,0,max));Object.assign(c,patch);const r=modelEstimate(c);record('更新月度成本与产能测算','价值管理','运行成本 '+M(r.total)+' · 净产能价值 '+M(r.net));render();toast('预算与收益测算已更新');
      }
      else if(a==='knowledge-search'){ui.opsKnowledgeQuery=val('ops-knowledge-search');ui.opsKnowledgeCategory=val('ops-knowledge-category');render();}
      else if(a==='knowledge-clear'){ui.opsKnowledgeQuery='';ui.opsKnowledgeCategory='全部分类';render();}
      else if(a==='knowledge-detail')knowledgeDetail(id);
      else if(a==='knowledge-export'){const k=db.knowledge.find(x=>x.id===id);if(!k)throw new Error('资料不存在');download(k.title+'.txt',k.title+'\n'+k.version+'\n资料编号：'+k.id+'\n\n'+k.text,'text/plain;charset=utf-8');}
      else if(a==='automation-toggle'){const item=db.automations.find(x=>x.id===id);if(!item)throw new Error('工作流不存在');item.enabled=!item.enabled;record(item.enabled?'启用工作流':'停用工作流','工作自动化',item.name);render();}
      else if(a==='automation-run')runAutomation(id);
      else if(a==='audit-search'){ui.opsAuditQuery=val('ops-audit-search');render();}
      else if(a==='audit-export')download(db.name+'-工作记录.json',JSON.stringify({workspace:db.name,exportedAt:new Date().toISOString(),logs:db.logs,tasks:db.tasks,purchases:db.purchases},null,2),'application/json;charset=utf-8');
      else if(a==='task-toggle'){const t=db.tasks.find(x=>x.id===id);if(!t)throw new Error('待办不存在');t.status=t.status==='完成'?'待办':'完成';record(t.status==='完成'?'完成工作待办':'重新打开待办','任务管理',t.name);render();}
      else return false;
    }catch(error){toast(error.message||'操作未完成，请核对输入');}
    return true;
  };
  window.extraChange=function(event){
    if(event.target.id==='ops-inventory-product'){ui.forecastProduct=event.target.value;render();return true;}
    if(event.target.id==='ops-knowledge-category'){ui.opsKnowledgeCategory=event.target.value;ui.opsKnowledgeQuery=val('ops-knowledge-search');render();return true;}
    return false;
  };
  render();
})();
