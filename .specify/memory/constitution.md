<!--
SYNC IMPACT REPORT - Constitution v1.0.1
========================================
Version Change: 1.0.0 → 1.0.1 (Patch update)

Modified Sections:
- 技术标准: React Native 0.73 → 0.83.x (latest stable version)
- 跨平台一致性原则: Added UI/UX design guidelines (美观性、菜单组织、操作流畅性)

Principle Summary:
1. 简洁架构 (Simple Architecture) - Avoid over-abstraction, maintainable structure
2. 跨平台一致性 (Cross-Platform Consistency) - Unified UX across platforms + UI/UX design standards
3. 实时同步优先 (Real-Time Sync First) - WebSocket-based state synchronization
4. 音质增强标准 (Audio Enhancement Standards) - High-quality audio processing
5. 代码质量与可维护性 (Code Quality & Maintainability) - Clean code practices

Change Rationale:
- React Native 0.73 is no longer supported; 0.83.x is the current stable release
- UI/UX design principles clarified to ensure aesthetic quality and user-friendly interaction

Templates Status:
✅ plan-template.md - No changes required
✅ spec-template.md - No changes required
✅ tasks-template.md - No changes required

Follow-up TODOs: None

Generated: 2026-01-02
-->

# MusicTogether 项目章程

## 核心原则

### I. 简洁架构
**原则**：项目目录结构简洁规范，代码整洁，不过度抽象，确保长期可维护性。

**具体要求**：
- 目录结构扁平化，避免不必要的嵌套层级
- 组件和模块命名清晰，见名知义
- 避免过早优化和过度设计模式
- 每个模块职责单一，边界清晰
- 代码复用以实际需求为准，不为复用而复用

**理由**：多平台音乐播放应用需要快速迭代和维护，过度抽象会增加理解成本和维护负担，简洁的架构更利于团队协作和长期演进。

### II. 跨平台一致性与界面美观
**原则**：使用 React Native 0.83.x + Expo 确保 iOS、Android、Web 三端体验一致，同时保持界面美观和操作友好。

**具体要求**：
- UI/UX 在各平台保持一致的交互逻辑
- 平台特定功能必须有降级方案
- 使用 Expo 提供的跨平台 API 优先
- 平台差异需在设计阶段明确并文档化
- 共享业务逻辑层，平台特定代码隔离

**界面设计要求**（强制）：
- 页面布局简洁美观，避免元素堆砌和视觉混乱
- 各级菜单结构清晰，层级关系明确，导航路径自然
- 操作流程设计遵循用户习惯，减少认知负担
- 交互反馈及时明确（如按钮点击、加载状态、错误提示）
- 配色、字体、间距统一规范，符合现代审美

**理由**：多端一致性是核心用户体验，用户在不同设备间切换时应保持操作习惯的连贯性。界面美观和操作友好能显著提升用户满意度和留存率。

### III. 实时同步优先
**原则**（关键特性）：使用 WebSocket 实现多设备间播放进度、播放列表、用户偏好设置的实时同步。

**具体要求**：
- WebSocket 连接的自动重连与断线恢复
- 冲突解决策略：最后写入优先（Last-Write-Wins）
- 离线状态下的本地队列与在线后的同步合并
- 同步状态必须对用户可见（连接指示器）
- 播放状态变更延迟 < 500ms（目标值）

**理由**：这是产品的核心差异化功能，用户期望在手机上暂停后在电脑上继续播放时无缝衔接。

### IV. 音质增强标准
**原则**：使用 Web Audio API 和 React Native Track Player 实现 EQ 均衡器和空间音效（如 Max Audio Atmos 风格）。

**具体要求**：
- EQ 均衡器至少支持 10 频段调节
- 预设音效场景（摇滚、古典、流行、人声等）
- 空间音效支持立体声增强和虚拟环绕声
- 音质处理不影响播放流畅性（CPU 占用 < 15%）
- 用户可自定义并保存音效配置，多端同步

**理由**：音质增强是产品的核心竞争力，专业级的音频处理能力能吸引高品质音乐爱好者。

### V. 代码质量与可维护性
**原则**：使用 TypeScript 严格模式，Bun 作为运行时和包管理器，确保类型安全和开发效率。

**具体要求**：
- 所有代码必须通过 TypeScript 严格检查（strict: true）
- 使用 ESLint + Prettier 统一代码风格
- 关键业务逻辑必须有单元测试覆盖
- 复杂组件必须有注释说明其职责和使用方式
- 使用 Bun 进行依赖管理和脚本执行

**理由**：TypeScript 提供编译时类型检查，减少运行时错误；Bun 提供更快的开发体验；代码规范确保团队协作效率。

## 技术标准

**核心技术栈**（不可变更）：
- **运行时**：Bun（开发环境）
- **语言**：TypeScript（strict 模式）
- **框架**：React Native 0.83.x + Expo（使用最新稳定版本）
- **音频引擎**：React Native Track Player
- **音频处理**：Web Audio API (Web), Native Audio (iOS/Android)
- **实时通信**：WebSocket（客户端-服务器双向通信）

**依赖管理**：
- 使用 Bun 进行包安装和脚本运行
- 避免引入大型第三方库，优先使用 Expo 生态内的解决方案
- 新增依赖必须评估包大小和维护状态

**性能目标**：
- 应用启动时间 < 2s（冷启动）
- 播放操作响应时间 < 300ms
- 同步延迟 < 500ms
- 内存占用 < 200MB（播放状态下）
- EQ 处理 CPU 占用 < 15%

## 开发标准

**项目结构**（强制规范）：
```
musictogether/
├── src/
│   ├── components/       # 可复用 UI 组件
│   ├── screens/          # 页面级组件
│   ├── services/         # 业务逻辑（音频、同步、存储）
│   ├── hooks/            # 自定义 React Hooks
│   ├── types/            # TypeScript 类型定义
│   ├── utils/            # 工具函数
│   └── constants/        # 常量定义
├── assets/               # 静态资源（图片、字体）
├── specs/                # 功能规格文档
└── tests/                # 测试文件
```

**代码规范**：
- 组件文件使用 PascalCase（如 `PlaybackControls.tsx`）
- 工具函数使用 camelCase（如 `formatDuration.ts`）
- 常量使用 UPPER_SNAKE_CASE（如 `MAX_VOLUME`）
- 每个模块导出内容清晰，避免默认导出（除组件外）

**文档要求**：
- 每个功能需求需有对应的 spec 文件（在 `/specs/` 目录下）
- 复杂算法（如冲突解决、音频处理）需有行内注释
- API 接口和 WebSocket 消息格式需文档化

**测试要求**（可选，但推荐）：
- 核心业务逻辑（同步算法、播放控制）必须有单元测试
- UI 组件可选快照测试
- WebSocket 连接需有集成测试

**中文优先**：
- 项目文档、注释、提交信息使用中文
- 代码中的变量名、函数名使用英文（遵循行业惯例）
- 用户界面文本支持国际化（i18n），默认简体中文

## 治理规则

**章程优先级**：
- 本章程是项目开发的最高指导原则
- 所有功能设计、技术选型必须符合本章程
- 违反章程的代码不予合并

**修订流程**：
- 章程修订需明确原因和影响范围
- 重大修订（核心原则变更）需团队共识
- 修订后需更新版本号并同步到相关文档

**版本控制**：
- 使用语义化版本号：MAJOR.MINOR.PATCH
- MAJOR：核心原则移除或重大重新定义
- MINOR：新增原则或章节
- PATCH：文字澄清、错误修正

**合规检查**：
- 功能规格文档（spec.md）必须引用相关章程原则
- 实现计划（plan.md）必须包含章程检查清单
- 代码审查时验证是否符合章程要求

**Version**: 1.0.1 | **Ratified**: 2026-01-02 | **Last Amended**: 2026-01-02
