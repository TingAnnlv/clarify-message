# Clarify Message

**让重要的事，浮出消息。**

A message-to-action workspace for freelancers and small teams: review work messages, trace every recommendation to its source, confirm deadlines, and plan reminders.

[打开网页](https://clarify-message.rainy-seed-4027.chatgpt.site) · [演示与参赛说明](docs/DEMO.md) · [认证与隐私](docs/AUTHENTICATION.md)

> 第一版可运行。托管网页默认仅所有者可访问，需要用创建网站的账号登录；向评委展示可使用录屏，公开链接需要另行调整分享权限。

## 可以做什么

- 粘贴工作消息或导入 UTF-8 文本。
- 使用本地关键词初筛，或连接 DeepSeek 分析上下文、改期和等待关系。
- 查看每一项建议的原文；不存在于输入的引用会被过滤。
- 修改负责人、优先级、截止和提醒时间，确认后加入行动清单。
- 在页面运行时提醒、稍后提醒、完成和重新打开事项。
- 导出带提醒的日历文件，以及导出/恢复本地 JSON 备份。
- 在电脑、手机浏览器上使用。

## 三种体验，明确区分

| 模式 | 是否调用 AI | 说明 |
| --- | --- | --- |
| 体验完整示例 | 否 | 虚构工作消息与预置分析，用于体验完整流程 |
| 本地初筛 | 否 | 关键词规则找出候选项，不推断日期或合并改期 |
| AI 分析 | 是 | 使用自己的 DeepSeek API Key，消息经本站服务转发至 DeepSeek |

首次打开，点击「体验完整示例」。展开原文，选择「核对并确认」，设置一个稍后的提醒时间，完成一次实际提醒测试。

真实 AI 分析需要在设置里填写自己的密钥并勾选发送同意。密钥只保存在当前页面内存中，刷新后需重新填写；不提交到 GitHub，不放进地址栏。模型费用由该账户承担。默认模型为 DeepSeek 官方文档列出的 `deepseek-flash`。

## 运行

需要 **Node.js 22.13+ 和 npm**（建议 Node.js 24）。

```sh
git clone https://github.com/TingAnnlv/clarify-message.git
cd clarify-message
npm ci
npm run dev
```

打开终端打印的本地网址。开发模式不需要网站托管账号或 AI 密钥即可体验示例/本地初筛。生产构建：

```sh
npm run test
npm run typecheck
npm run build
npm run start
```

如果托管配置了访问控制，线上权限由 Sites 处理；本地开发服务不要直接暴露到公网。

## 文件怎么读

```text
app/
  page.tsx                 页面、确认操作、本地保存和提醒
  globals.css              响应式样式
  api/analyze/route.ts      服务端 AI 转发与输入校验
lib/clarify.ts              数据结构、结果校验、示例、初筛、日历
scripts/check.mjs          核心逻辑与模拟接口测试
tests/                     浏览器操作测试
docs/                      演示、认证与验证说明
public/                    图标
build/, scripts/, vendor/  Sites/Vinext 运行和构建支持
.openai/hosting.json        网站托管标识；不是密钥
```

页面使用 React，服务端使用 Vinext/Cloudflare Workers；保留 Sites 提供的构建集成。应用不需要数据库。

## 目前的边界

- **不自动读取微信、QQ 或其他 App**。消息通过用户粘贴或文本导入。
- 消息与行动项保存在当前浏览器的 localStorage，不跨设备同步。共享电脑使用后可在设置里清除数据。
- AI 模式会把输入发送到 DeepSeek；本地初筛不会上传消息。应用代码不记录消息或密钥日志。
- **网页关闭、设备休眠或浏览器限制后台运行时，网页提醒不保证按时触发。** 关闭网页后需要提醒，请导入日历并核对日历权限及闹钟。日历导出是快照，事项变更后需重新导出。
- AI 结果可能错误，必须人工确认；原文校验只证明引用存在，不保证结论正确。
- 重新分析会替换当前批次，页面会询问；需要保留时先导出备份。
- 真实付费 AI 调用尚未用用户密钥实测。自动测试覆盖模拟响应、失败和输入边界；示例结果不能作为真实模型效果证明。

## ForgeHacks

拟参加 **AI + Business**：把客户/团队的非结构化消息转为有证据的行动建议，帮助决定先处理什么。强调真实业务场景、改期与等待关系，而不是仅仅提取日期。最终赛题认定由主办方决定。

- [官方赛题](https://www.forgehacks.dev/)
- [提交要求](https://forgehacks-2026.devpost.com/)

## 开发参考

界面设计参考 [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)；实现采用 ponytail 的最小可用原则，托管采用 Sites。AI 接口依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/)。没有自动安装 GitHub 上的第三方代码或运行其脚本。
