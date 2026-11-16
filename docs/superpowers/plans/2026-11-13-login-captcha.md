# 登录图形验证码实施计划

> 执行方式：在当前会话按 superpowers:executing-plans 连续实施，不增加分段审批。

**目标：** 按用户已确认方案，在密码登录中加入后端强制校验的图形验证码，降低自动撞库和暴力猜密码风险。

**方案依据：** 当前会话已确认的“图形验证码＋现有登录限流”方案。

**架构：** 沿用 Express 登录路由和 React 登录页面。验证码随机值和一次性凭证在后端生成，答案仅保留在有数量上限的短期内存缓存；后端生成字形并栅格化为 PNG，避免客户端直接读取文本或匹配向量字形。复用现有登录限流，企业微信单点登录不变。

**技术：** Node.js crypto、Express、svg-captcha、@resvg/resvg-js、现有 React / Ant Design / API 契约；不修改数据库。

## 全局约束

- 5 位不易混淆的字母和数字，不区分大小写，2 分钟有效，一次提交后失效。
- 后端先检查限流和验证码，再查询账号和校验密码；不存在无验证码的兼容入口。
- 获取验证码接口单独限流、缓存设上限、过期清理；答案不返回、不写日志。
- 沿用登录布局，字段错误就地显示，获取失败可重试，提交失败换新图并保留账号密码。
- 保留工作区已有无关改动；不提交 Git、不发布正式环境。

## 核查重点

- 缺失、错误、过期、重复使用及其他客户端提交都必须在查询用户前拒绝。
- 并发提交只能成功消费一次；刷新请求乱序不应覆盖最新图片。
- 登录限流到期后重新计数，不能沿用已锁定次数立即再次锁定。
- 验证码获取失败、服务重启、首次改密退出后均可重新获取并继续登录。
- 所有已有密码登录测试和部署调用示例同步携带验证码，无测试后门。

## 任务 1：验证码及接口防绕过

文件：`backend/src/services/loginCaptchaService.js`、`backend/src/routes/auth.js`、`backend/test/loginCaptchaService.test.js`、`backend/test/authCaptchaRoutes.test.js`、后端依赖与现有 HTTP 集成测试。

- [x] 先编写并运行失败测试：一次性、过期、错误、参数类型、客户端绑定、图片不含答案、获取限流和缓存上限。
- [x] 实现 `createLoginCaptchaService({ now, renderImage })`，提供 `issue(clientIp)` / `consume(clientIp, id, code)`。
- [x] 增加 `GET /api/auth/captcha`，返回 `{ captcha_id, image, expires_in }`；密码登录必填 `captcha_id` / `captcha_code`。
- [x] 补齐真实 HTTP 路由测试，断言验证码失败不会查询数据库，成功后正常创建会话，限流及首次改密继续有效。
- [x] 运行后端相关测试并同步既有集成测试的验证码输入。

## 任务 2：登录页与调用说明

文件：`frontend/src/api/authApi.ts`、`frontend/src/modules/auth/pages/LoginPage.tsx`、`LoginPage.css`、`deploy/README.md`、产品版本说明。

- [x] API 层增加验证码结果契约和必填登录参数。
- [x] 页面增加验证码输入、图片刷新、加载失败重试和字段错误，处理刷新乱序与提交中重复操作。
- [x] 同步部署调用示例和本批次版本说明。
- [x] 用浏览器验证正确/错误验证码、刷新、加载失败重试、首次改密及窄屏布局。

## 任务 3：验收

- [x] 在 SIDM 既有端口启动最新后端 3103、前端 3104，验证健康状态。
- [x] 运行 `node scripts/verify-change.mjs`，核对所有结果及后端运行态新鲜度。
- [x] 独立审阅本次范围内差异，修复影响本次登录安全或功能的发现。
- [x] 交付实际验证结果、无 migration / 未提交 / 未发布状态及真实限制。

## 执行记录

- 沿用当前工作区并切换到 `codex/login-image-captcha`，保留开工前已有无关改动。
- 独立审阅复现 SVG 字形可直接匹配答案的问题，改为服务端 PNG 栅格化；回归测试先失败后通过，复核未发现剩余 P1/P2。
- 完整门禁通过：后端 993 项通过、22 项按既有条件跳过；新增验证码测试 13 项均通过。
- 在临时独立 schema 上完成 9 项真实 HTTP / PostgreSQL 测试、4 项 Chromium 浏览器验收，随后删除测试 schema 并回读确认无残留。
- 浏览器插件未提供，使用项目已安装的 Playwright；1440×1000 和 375×812 页面均正常、无脚本错误或横向溢出。截图放在仓库外 `/tmp/sidm-captcha-desktop.png`、`/tmp/sidm-captcha-mobile.png`。
- 本地后端已加载最新源码，3103 健康接口及 3104 登录页面均返回 200；已核验 arm64 / x64 本机图片渲染依赖均可加载。
- 无数据库结构变更和 migration，未提交 Git、未正式发布。多实例需共享缓存；企业微信外部授权未做真实远程验收。
