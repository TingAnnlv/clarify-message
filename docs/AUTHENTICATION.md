# 认证、请求流程与凭据

## 组件

- 浏览器页面：输入消息、保管本次页面内存里的 DeepSeek API Key、确认发送、保存本地行动项。
- Sites 访问控制：托管版本默认 owner-private，访问由平台登录和授权控制。应用不实现独立账号密码。
- `POST /api/analyze`：验证来源、大小、日期、时区、发送同意和密钥形状，再调用 DeepSeek。
- DeepSeek：检查它自己的 API Key，处理模型推理。
- 结果校验：限制事项数量，核对引用是否确实存在于输入，校验截止时间，默认所有事项为待人工确认。

## 请求流

```text
访问私有站点 → Sites 登录/访问控制 → 网页
用户填写临时密钥并同意发送
  → POST /api/analyze { source, reference, timeZone, consent, apiKey }
  → 服务端输入检查
  → HTTPS https://api.deepseek.com/chat/completions
       Authorization: Bearer <用户本次提供的密钥>
  → 解析模型 JSON → 核对引用与日期 → 返回待确认行动项
  → 用户确认 → localStorage → 网页提醒/日历导出
```

本地初筛和示例在浏览器执行，不调用分析接口。

## 密钥与令牌

- API Key 存在 React state 中，刷新即丢失，不写 localStorage、备份、Git、URL 或日志。
- 用户点击 AI 分析才通过 HTTPS 交给本站转发；只允许转发到硬编码的 DeepSeek 官方地址，不支持自定义转发目标。
- 服务端不持久化密钥、消息和模型返回值，响应设置 `Cache-Control: no-store`。
- 不把上游错误正文返回浏览器，防止回显凭据或内部信息。
- 应用没有 refresh token、OAuth 回调或自建会话 Cookie。平台登录会话属于 Sites，不由业务代码处理。
- 生成日历和下载备份不涉及额外第三方授权。
- Sites 发布凭据仅用于构建期间的受控上传，不包含在源码或产物中。

## 边界

Origin 校验用于限制跨站浏览器请求，不能代替用户身份认证。托管私有站点依赖 Sites 外层访问控制。本地开发环境不提供应用级登录；不要直接当公共服务运行。

接口只使用请求者提供的 DeepSeek Key，不使用所有者共享密钥。若以后改为共享密钥或公共多用户服务，需要增加服务端身份校验、配额和持久化限流，再开放访问。

聊天内容和模型输出都不可信。模型没有工具调用权限，不能替用户发送消息；前端使用 React 文本渲染，输出不作为 HTML 插入。引用校验无法消除模型误判，用户需核对每个行动项。
