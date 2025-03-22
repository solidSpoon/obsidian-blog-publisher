# Obsidian Blog Publisher

这是一个用于将 Obsidian 笔记发布为博客的插件。它可以将带有 `blog` 标签的笔记自动发布到 GitHub 仓库，并生成一个美观的博客网站。

## 功能特点

- 自动识别带有 `blog` 标签的笔记
- 支持 YAML frontmatter 中的 `date` 属性（格式：yyyy-MM）
- 按日期降序排列博客文章
- 自动生成博客列表页和文章详情页
- 支持 Markdown 格式
- 使用 GitHub 风格的样式
- 一键发布到 GitHub 仓库

## 安装方法

1. 下载最新版本的发布包
2. 解压并将文件夹放入 Obsidian 插件目录
3. 在 Obsidian 中启用插件

## 使用方法

1. 在设置中配置 GitHub 相关信息：
   - GitHub Token（个人访问令牌）
   - GitHub 仓库名
   - GitHub 用户名
   - 博客描述

2. 在要发布的笔记中添加以下 frontmatter：
   ```yaml
   ---
   tags: [blog]
   date: 2024-03
   ---
   ```

3. 点击左侧工具栏的发布按钮或使用命令面板中的"发布博客"命令

## 注意事项

- 确保 GitHub Token 具有仓库的写入权限
- 仓库需要是公开的，这样才能通过 GitHub Pages 访问
- 建议在发布前先在本地预览效果

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 许可证

MIT
