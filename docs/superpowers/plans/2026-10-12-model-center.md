# 模型中心实施计划

**Goal:** 在基础设置管理模型配置，数字孪生读取默认模型。
**Architecture:** 独立配置表、管理权限和后端密钥文件；复用已有页面模板、审计、迁移工具。模型调用固定 Chat Completions 协议。
**Spec:** docs/features/llm-access-design.md（已确认，菜单改为模型中心）

- [x] 测试并实现URL校验、加密密钥、配置CRUD、默认唯一、审计和接口权限；同步初始化SQL、migration、结构Markdown/Excel。
- [x] 实现模型中心列表、编辑、详情及真实连接测试；数字孪生读取启用默认配置，配置版本变化使缓存失效。
- [x] 执行授权的本地迁移；验证真实保存、默认设置、模型调用、密钥不回显、权限及失败状态，运行完整门禁；保留正式环境部署边界。

主要文件：backend/src/services/modelConnectionService.js、modelTransport.js、modelSecret.js，backend/src/routes/modelConnections.js，frontend/src/modules/model-center/pages/*，frontend/src/api/modelConnectionApi.ts，frontend/src/app/routes.tsx，backend/src/app.js，deploy/install-and-start.sh，docs/数据库表结构.md及.xlsx。
