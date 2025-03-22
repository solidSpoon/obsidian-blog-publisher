import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Octokit } from '@octokit/rest';
import { marked } from 'marked';

// Remember to rename these classes and interfaces!

interface BlogPost {
	title: string;
	date: string;
	content: string;
	slug: string;
}

interface BlogPluginSettings {
	githubToken: string;
	githubRepo: string;
	githubOwner: string;
	blogDescription: string;
}

const DEFAULT_SETTINGS: BlogPluginSettings = {
	githubToken: '',
	githubRepo: '',
	githubOwner: '',
	blogDescription: '我的个人博客'
}

export default class BlogPlugin extends Plugin {
	settings: BlogPluginSettings;
	octokit: Octokit;

	async onload() {
		await this.loadSettings();
		
		// 初始化 GitHub API 客户端
		this.octokit = new Octokit({
			auth: this.settings.githubToken
		});

		// 添加发布按钮到左侧工具栏
		this.addRibbonIcon('book', '发布博客', (evt: MouseEvent) => {
			this.publishBlog();
		});

		// 添加发布命令
		this.addCommand({
			id: 'publish-blog',
			name: '发布博客',
			callback: () => {
				this.publishBlog();
			}
		});

		// 添加设置页面
		this.addSettingTab(new BlogSettingTab(this.app, this));

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async publishBlog() {
		try {
			// 获取所有带有 blog 标签的文件
			const files = this.app.vault.getMarkdownFiles();
			const blogPosts: BlogPost[] = [];

			for (const file of files) {
				const fileContent = await this.app.vault.read(file);
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
				
				if (frontmatter?.tags?.includes('blog') && frontmatter?.date) {
					const title = file.basename;
					const date = frontmatter.date;
					const slug = this.generateSlug(title);
					
					// 检查 slug 是否为空
					if (!slug) {
						new Notice(`警告：文件 "${title}" 生成的 slug 为空，已跳过`);
						continue;
					}
					
					blogPosts.push({
						title,
						date,
						content: fileContent,
						slug
					});
				}
			}

			if (blogPosts.length === 0) {
				new Notice('没有找到带有 blog 标签的文章');
				return;
			}

			// 按日期降序排序
			blogPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

			// 生成博客列表页
			const indexHtml = this.generateIndexHtml(blogPosts);

			// 生成每篇博客的详情页
			for (const post of blogPosts) {
				const postHtml = this.generatePostHtml(post);
				try {
					await this.uploadToGithub(post.slug + '.html', postHtml);
					new Notice(`成功发布文章：${post.title}`);
				} catch (error) {
					new Notice(`发布文章 "${post.title}" 失败：${error.message}`);
				}
			}

			// 上传列表页
			await this.uploadToGithub('index.html', indexHtml);
			new Notice('博客发布成功！');
		} catch (error) {
			new Notice('发布失败：' + error.message);
			console.error('发布失败：', error);
		}
	}

	generateSlug(title: string): string {
		if (!title) return '';
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.replace(/^$/, 'untitled'); // 如果结果为空，使用 'untitled'
	}

	generateIndexHtml(posts: BlogPost[]): string {
		const postsList = posts.map(post => `
			<div class="post-item">
				<h2><a href="${post.slug}.html">${post.title}</a></h2>
				<div class="post-date">${post.date}</div>
			</div>
		`).join('');

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>我的博客</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
						line-height: 1.6;
						max-width: 800px;
						margin: 0 auto;
						padding: 20px;
					}
					.header {
						text-align: center;
						margin-bottom: 40px;
					}
					.post-item {
						margin-bottom: 30px;
						padding-bottom: 20px;
						border-bottom: 1px solid #eee;
					}
					.post-date {
						color: #666;
						font-size: 0.9em;
					}
				</style>
			</head>
			<body>
				<div class="header">
					<h1>我的博客</h1>
					<p>${this.settings.blogDescription}</p>
				</div>
				<div class="posts">
					${postsList}
				</div>
			</body>
			</html>
		`;
	}

	generatePostHtml(post: BlogPost): string {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>${post.title}</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
						line-height: 1.6;
						max-width: 800px;
						margin: 0 auto;
						padding: 20px;
					}
					.header {
						text-align: center;
						margin-bottom: 40px;
					}
					.post-date {
						color: #666;
						font-size: 0.9em;
					}
					.back-link {
						display: inline-block;
						margin-top: 20px;
						color: #0366d6;
						text-decoration: none;
					}
				</style>
			</head>
			<body>
				<div class="header">
					<h1>${post.title}</h1>
					<div class="post-date">${post.date}</div>
				</div>
				<div class="content">
					${this.convertMarkdownToHtml(post.content)}
				</div>
				<a href="index.html" class="back-link">← 返回首页</a>
			</body>
			</html>
		`;
	}

	convertMarkdownToHtml(markdown: string): string {
		// 配置 marked 选项
		marked.setOptions({
			gfm: true, // 启用 GitHub 风格的 Markdown
			breaks: true // 将换行符转换为 <br>
		});

		// 移除 frontmatter
		const content = markdown.replace(/^---[\s\S]*?---/, '');

		// 转换 Markdown 为 HTML
		return marked(content);
	}

	async uploadToGithub(filename: string, content: string) {
		if (!this.settings.githubToken || !this.settings.githubRepo || !this.settings.githubOwner) {
			throw new Error('请先在设置中配置 GitHub Token、仓库名和用户名');
		}

		if (!filename || filename === '.html') {
			throw new Error('无效的文件名');
		}

		try {
			console.log(`正在上传文件：${filename} 到 ${this.settings.githubOwner}/${this.settings.githubRepo}`);
			
			// 尝试获取文件信息
			let sha: string | undefined;
			try {
				const { data } = await this.octokit.repos.getContent({
					owner: this.settings.githubOwner,
					repo: this.settings.githubRepo,
					path: filename,
				});
				
				if (!Array.isArray(data)) {
					sha = data.sha;
				}
			} catch (error) {
				// 文件不存在，这是正常的
				console.log(`文件 ${filename} 不存在，将创建新文件`);
			}

			// 创建或更新文件
			await this.octokit.repos.createOrUpdateFileContents({
				owner: this.settings.githubOwner,
				repo: this.settings.githubRepo,
				path: filename,
				message: `Update ${filename}`,
				content: Buffer.from(content).toString('base64'),
				sha: sha // 如果文件存在，提供 sha；如果是新文件，sha 为 undefined
			});
			
			console.log(`文件 ${filename} 上传成功`);
		} catch (error) {
			console.error(`上传文件 ${filename} 失败:`, error);
			throw new Error(`上传文件失败: ${error.message}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class BlogSettingTab extends PluginSettingTab {
	plugin: BlogPlugin;

	constructor(app: App, plugin: BlogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub Token')
			.setDesc('你的 GitHub 个人访问令牌')
			.addText(text => text
				.setPlaceholder('输入你的 GitHub Token')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub 仓库')
			.setDesc('用于存放博客的 GitHub 仓库名')
			.addText(text => text
				.setPlaceholder('输入仓库名')
				.setValue(this.plugin.settings.githubRepo)
				.onChange(async (value) => {
					this.plugin.settings.githubRepo = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub 用户名')
			.setDesc('你的 GitHub 用户名')
			.addText(text => text
				.setPlaceholder('输入 GitHub 用户名')
				.setValue(this.plugin.settings.githubOwner)
				.onChange(async (value) => {
					this.plugin.settings.githubOwner = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('博客描述')
			.setDesc('显示在博客首页的简短描述')
			.addText(text => text
				.setPlaceholder('输入博客描述')
				.setValue(this.plugin.settings.blogDescription)
				.onChange(async (value) => {
					this.plugin.settings.blogDescription = value;
					await this.plugin.saveSettings();
				}));
	}
}
