# GitHub / Gitee 托管与提交日志指南

**目标**：把当前仓库推送到 **Public** 仓库，保留 21+ 条细粒度提交，满足比赛「公开可访问 + 完整 Git 历史」的要求。

当前仓库已经完成：

- `git init`，分支 `main`；
- 25 个按功能模块拆分的提交（2026-11-01 至 2026-11-09）；
- 首个提交只包含工程约定，不是 `initial commit` 全量代码；
- `.env`、`artifacts/idle/`、`docs/build/` 等中间产物已在 `.gitignore` 中排除。

---

## 1. 推送前检查

```powershell
git log --oneline --reverse
git rev-list --count HEAD     # 应为 25
git status                    # 应为 clean
git remote -v                 # 应为空（还没有远端）
```

如果 `git status` 不干净，先提交或还原，不要带着未提交改动推送。

**作者身份**：25 条提交已统一为 `Marisa_Magical <199616031+Marisa106@users.noreply.github.com>`，与 GitHub 账号 [Marisa106](https://github.com/Marisa106) 对应；后续提交沿用该身份即可。

---

## 2. 方式 A：GitHub（推荐）

### 2.1 创建仓库

1. 登录 GitHub → **New repository**；
2. Repository name：`big-fat-fish-adventure`（或 `da-fei-yu`）；
3. 选择 **Public**；
4. **不要**勾选 README、.gitignore、license（本地已有）；
5. Create repository。

### 2.2 关联并推送

```powershell
git remote add origin https://github.com/<你的用户名>/big-fat-fish-adventure.git
git branch -M main
git push -u origin main
```

首次推送会弹出 Git Credential Manager 登录；如果失败，使用 GitHub Personal Access Token（classic 或 fine-grained，至少 `repo` / `Contents: Read and write`）作为密码。

### 2.3 仓库设置

- **Settings → General → Danger Zone**：确认 Visibility 为 **Public**；
- **About**：填写描述与 topics，例如
  `deepseek` `ai-literacy` `turn-based` `vanilla-js` `game` `competition`；
- **Actions**：确认 `CI` 工作流已运行并通过（`npm test` + `npm run sim`）；
- 如果仓库必须私有：**Settings → Collaborators → Add people**，给评委只读权限，并在提交材料中写明账号。

### 2.4 验证公开可访问

退出登录或开无痕窗口，访问：

```text
https://github.com/<你的用户名>/big-fat-fish-adventure
```

应能看到 README、25 条提交、`docs/` 与 `assets/`；点 **Commits** 应看到从 `chore: 初始化零依赖工程与仓库约定` 开始的完整历史。

---

## 3. 方式 B：Gitee

### 3.1 创建仓库

1. 登录 Gitee → **新建仓库**；
2. 仓库名称：`big-fat-fish-adventure`；
3. 选择 **开源** / **公开**；
4. 不要初始化 README、.gitignore、license；
5. 创建。

### 3.2 关联并推送

```powershell
git remote add gitee https://gitee.com/<你的用户名>/big-fat-fish-adventure.git
git branch -M main
git push -u gitee main
```

Gitee 首次推送通常使用账号密码或私人令牌；按页面提示完成认证。

### 3.3 仓库设置

- **仓库设置 → 基本信息**：确认「开源」/「公开」；
- **仓库设置 → 仓库成员管理**：如需私有，添加评委为「观察者」；
- 确认默认分支为 `main`；
- 在仓库首页确认提交历史完整。

### 3.4 验证公开可访问

无痕窗口访问：

```text
https://gitee.com/<你的用户名>/big-fat-fish-adventure
```

点「提交」应看到 25 条提交；点「代码」应能看到 `index.html`、`docs/`、`assets/`。

---

## 4. 同时推送 GitHub 与 Gitee（可选）

```powershell
git remote add origin https://github.com/<user>/big-fat-fish-adventure.git
git remote add gitee  https://gitee.com/<user>/big-fat-fish-adventure.git

git push -u origin main
git push -u gitee main
```

以后更新：

```powershell
git push origin main
git push gitee main
```

---

## 5. 大仓库推送注意事项

当前 `.git` 约 110 MB（含 25 张截图、验收图、4 段结局成片与 BGM）。首次推送可能需要几分钟。

如果推送中断：

```powershell
git config http.postBuffer 524288000
git push -u origin main
```

如果远端已经有内容（例如创建仓库时勾选了 README），先拉取再推送：

```powershell
git pull --rebase origin main
git push -u origin main
```

不要使用 `git push --force` 覆盖已有历史，除非确认远端没有需要保留的提交。

---

## 6. 提交日志的检查方式

```powershell
git log --oneline --reverse
git log --stat --oneline
git show --stat c7c6270      # 开发者模式这一次提交
git show c7c6270:index.html  # 查看该提交下的标题页
```

评委常看的点：

1. 第一条提交是否只包含工程约定（不是全量代码）；
2. 是否有 `feat(core)`、`feat(asset)`、`feat(ui)`、`feat(dev)`、`test`、`docs`、`ci` 等分明细；
3. 开发者模式是否有独立提交，并且提交说明写了「二次确认/取消不写入」；
4. 文档与测试是否在代码之后单独提交；
5. 提交时间是否呈现 11-01 → 11-09 的迭代顺序。

---

## 7. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `src refspec main does not match any` | 还没有提交或分支名不是 main | `git branch -M main` 后再推 |
| `Authentication failed` | 密码/令牌错误 | 用 PAT 或 Gitee 私人令牌；检查账号 |
| `remote origin already exists` | 已配置过远端 | `git remote set-url origin <新地址>` |
| 推送卡住/断开 | 仓库较大或网络不稳 | 设置 `http.postBuffer`；换网络重试 |
| 网页上看不到提交 | 推到了别的分支 | 确认默认分支为 `main`，`git branch -vv` |
| 作者显示为占位身份 | 本地 Git 未配置你的账号 | 推送前配置；已成历史可重写 |
| 中文文件名乱码 | Git 转义 | `git config core.quotepath false` |
| 仓库私有导致评委打不开 | Visibility 不是 Public | 改 Public，或添加评委只读成员 |

---

## 8. 最后检查清单

- [ ] 仓库为 Public，或已给评委只读权限
- [ ] 默认分支 `main`
- [ ] `git rev-list --count HEAD` ≥ 25
- [ ] 首条提交不是全量代码
- [ ] 提交说明能对应功能模块 / AI 对话
- [ ] `docs/`、`assets/`、`tests/`、`tools/` 均已上传
- [ ] `.env` 没有被上传
- [ ] README 中的截图、文档链接在网页上可打开
- [ ] GitHub Actions（如使用 GitHub）为绿色
- [ ] 无痕窗口可访问仓库首页与 Commits 页
