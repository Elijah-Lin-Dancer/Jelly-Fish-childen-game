# 提交身份守护钩子 · Commit-Identity Guard

## 为什么有这个东西

本项目历史曾被**假邮箱**污染：

- `elijah.lin.dancer@gmail.com` —— 未关联任何 GitHub 账号，被计为 **Anonymous（匿名贡献者）**
- `elijah@users.noreply.github.com` —— 格式不规范，被错误匹配到一个陌生人账号（"Elijah Wright"）

结果 GitHub 贡献者列表里混入了两个**并非作者**的身份。根因是某个环境（IDE / 工具）
在没有全局 git 邮箱配置时，用工具自己拼的身份提交。

2026-10 已用 `git filter-repo` 将全部历史统一为作者真邮箱 `linyvlin718@gmail.com`。
本钩子用于**从源头防止复发**。

## 它做什么

每次 `git commit` 前校验 `user.email`，若不在白名单内则**拒绝提交**并给出修复指引。

## 如何启用（克隆仓库后必做一次）

```bash
git config core.hooksPath .githooks
```

> ⚠️ Git 出于安全考虑，**不会自动运行仓库里的钩子**，必须显式指定 `core.hooksPath` 后才会生效。

## 如何修改允许的邮箱

编辑 `pre-commit` 里的 `ALLOWED` 变量（空格分隔可加多个）。

## 配套的"一劳永逸"三层防线

| 层 | 位置 | 作用 |
| :--- | :--- | :--- |
| 1️⃣ 全局身份 | `~/.gitconfig` 的 `user.email` | 所有仓库默认用真邮箱 |
| 2️⃣ 仓库身份 | 本仓库 `.git/config` 的 `user.email` | 本项目专属保险 |
| 3️⃣ 拦截钩子 | `.githooks/pre-commit` | 万一走错身份，提交前拦下 |
