import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { marked } from 'marked';
import { pinyin } from 'pinyin-pro';
import { GithubService, GithubConfig } from './services/github-service';
import { TemplateService } from './services/template-service';
import { FileSystemAdapter } from 'obsidian';

// Remember to rename these classes and interfaces!

interface BlogPost {
	title: string;
	date: string;
	content: string;
	slug: string;
	excerpt?: string;
	searchContent?: string;
}

interface BlogPluginSettings {
	githubToken: string;
	githubRepo: string;
	githubOwner: string;
	blogDescription: string;
	shouldUploadToGithub: boolean;
	githubBranch: string;
}

const DEFAULT_SETTINGS: BlogPluginSettings = {
	githubToken: '',
	githubRepo: '',
	githubOwner: '',
	blogDescription: '我的个人博客',
	shouldUploadToGithub: true,
	githubBranch: 'main'
}

export default class BlogPlugin extends Plugin {
	settings: BlogPluginSettings;
	githubService: GithubService;
	templateService: TemplateService;

	// 获取当前月份的 YYMM 格式
	private getCurrentMonth(): string {
		const now = new Date();
		const year = now.getFullYear() % 100; // 获取年份后两位
		const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 获取月份，补零
		return `${year}${month}`;
	}

	// 将 YYMM 格式转换为 YYYY-MM 格式
	private convertMonthFormat(month: string): string {
		if (!month || typeof month !== 'string') return '';
		
		// 确保输入是4位数字格式
		if (!/^\d{4}$/.test(month)) return '';
		
		const year = parseInt(month.substring(0, 2));
		const monthStr = month.substring(2);
		
		// 只处理21世纪的日期
		const fullYear = 2000 + year;
		
		return `${fullYear}-${monthStr}`;
	}

	// 获取临时目录路径
	private getTempDir(): string {
		// 使用插件目录下的 temp 文件夹
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return `${this.app.vault.configDir}/plugins/${this.manifest.id}/temp`;
		}
		throw new Error('不支持的文件系统适配器');
	}

	// 确保临时目录存在
	private async ensureTempDir(): Promise<void> {
		const tempDir = this.getTempDir();
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(tempDir))) {
			await adapter.mkdir(tempDir);
		}
	}

	// 清理临时目录
	private async cleanTempDir(): Promise<void> {
		const tempDir = this.getTempDir();
		const adapter = this.app.vault.adapter;
		if (await adapter.exists(tempDir)) {
			const files = await adapter.list(tempDir);
			for (const file of files.files) {
				await adapter.remove(file);
			}
		}
	}

	async onload() {
		await this.loadSettings();

		// 初始化 GitHub 服务
		this.initGithubService();

		// 初始化模板服务
		this.templateService = new TemplateService(this.app);

		// 添加发布按钮到左侧工具栏
		this.addRibbonIcon('upload', '发布博客', (evt: MouseEvent) => {
			const confirmMessage = '确定要发布所有带有 blog 标签的文章吗？';
			if (window.confirm(confirmMessage)) {
				this.publishBlog();
			}
		});

		// 添加发布命令
		this.addCommand({
			id: 'publish-blog',
			name: '发布博客',
			callback: () => {
				const confirmMessage = '确定要发布所有带有 blog 标签的文章吗？';
				if (window.confirm(confirmMessage)) {
					this.publishBlog();
				}
			}
		});

		// 添加设置页面
		this.addSettingTab(new BlogSettingTab(this.app, this));
	}

	onunload() {

	}

	private initGithubService() {
		const config: GithubConfig = {
			token: this.settings.githubToken,
			owner: this.settings.githubOwner,
			repo: this.settings.githubRepo,
			branch: this.settings.githubBranch
		};
		this.githubService = new GithubService(config);
	}

	async publishBlog() {
		try {
			// 确保临时目录存在并清理旧文件
			await this.ensureTempDir();
			await this.cleanTempDir();

			// 获取所有带有 blog 标签的文件
			const files = this.app.vault.getMarkdownFiles();
			const blogPosts: BlogPost[] = [];

			for (const file of files) {
				const fileContent = await this.app.vault.read(file);
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

				if (frontmatter?.tags?.includes('blog')) {
					const title = file.basename;
					// 如果没有 month 属性，使用当前月份
					const monthValue = frontmatter.month?.toString() || this.getCurrentMonth();
					const date = this.convertMonthFormat(monthValue);

					// 如果日期转换失败，跳过这篇文章
					if (!date) {
						new Notice(`警告：文件 "${title}" 的月份格式无效，已跳过`);
						continue;
					}

					// 如果原来没有 month 属性，添加到 frontmatter
					if (!frontmatter.month) {
						await this.updateFrontmatter(file, { ...frontmatter, month: monthValue });
						new Notice(`已为文章 "${title}" 自动添加当前月份：${monthValue}`);
					}

					// 获取或生成 slug
					let slug = frontmatter.slug;
					if (!slug) {
						slug = this.generateSlug(title);
						// 更新文件的 frontmatter，添加 slug
						await this.updateFrontmatter(file, { ...frontmatter, slug });
					}

					// 检查 slug 是否为空
					if (!slug) {
						new Notice(`警告：文件 "${title}" 生成的 slug 为空，已跳过`);
						continue;
					}

					// 移除 frontmatter 获取纯内容
					const content = fileContent.replace(/^---[\s\S]*?---/, '');

					// 移除 Markdown 图片语法
					const cleanContent = content
						.replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // 移除图片语法
						.replace(/<img[^>]+>/g, ''); // 移除 HTML 图片标签

					// 生成摘要（取前 200 个字符）
					const excerpt = cleanContent.replace(/[#*`~>]/g, '').trim().slice(0, 200) + '...';

					// 生成搜索内容（移除 Markdown 标记）
					const searchContent = cleanContent
						.replace(/[#*`~>]/g, '') // 移除 Markdown 标记
						.replace(/\n/g, ' ') // 将换行替换为空格
						.replace(/\s+/g, ' ') // 将多个空格替换为单个空格
						.trim();

					blogPosts.push({
						title,
						date,
						content: fileContent,
						slug,
						excerpt,
						searchContent
					});
				}
			}

			if (blogPosts.length === 0) {
				new Notice('没有找到带有 blog 标签的文章');
				return;
			}

			// 检查是否有重复的 slug
			const slugCount = new Map<string, string[]>();
			for (const post of blogPosts) {
				if (!slugCount.has(post.slug)) {
					slugCount.set(post.slug, [post.title]);
				} else {
					slugCount.get(post.slug)?.push(post.title);
				}
			}

			// 如果发现重复的 slug，报错并终止操作
			const duplicateSlugs = Array.from(slugCount.entries())
				.filter(([_, titles]) => titles.length > 1);
			
			if (duplicateSlugs.length > 0) {
				const errorMessage = duplicateSlugs.map(([slug, titles]) => 
					`Slug "${slug}" 在以下文章中重复:\n${titles.map(title => `  - ${title}`).join('\n')}`
				).join('\n\n');
				
				new Notice('发现重复的 slug，发布操作已终止');
				throw new Error(`发现重复的 slug:\n${errorMessage}`);
			}

			// 按日期降序排序
			blogPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

			// 准备要上传的文件列表
			const filesToUpload: { path: string; content: string }[] = [];
			const tempDir = this.getTempDir();
			const adapter = this.app.vault.adapter;

			// 生成博客列表页
			const indexHtml = this.generateIndexHtml(blogPosts);
			const indexPath = `${tempDir}/index.html`;
			await adapter.write(indexPath, indexHtml);
			filesToUpload.push({
				path: 'index.html',
				content: indexHtml
			});

			// 生成每篇博客的详情页
			for (const post of blogPosts) {
				const postHtml = this.generatePostHtml(post, blogPosts);
				const postPath = `${tempDir}/${post.slug}.html`;
				await adapter.write(postPath, postHtml);
				filesToUpload.push({
					path: `${post.slug}.html`,
					content: postHtml
				});
			}

			// 根据设置决定是否上传到 GitHub
			if (this.settings.shouldUploadToGithub) {
				// 批量上传文件
				const uploadResult = await this.githubService.uploadFiles(filesToUpload);

				// 处理上传结果
				uploadResult.results.forEach((result: { path: string; success: boolean; message: string; skipped?: boolean }) => {
					if (result.success) {
						if (!result.skipped) {
							new Notice(`成功发布：${result.path}`);
						}
					} else {
						new Notice(`发布失败：${result.path} - ${result.message}`);
					}
				});

				if (uploadResult.success) {
					new Notice('博客发布成功！');
				} else {
					new Notice('部分文章发布失败，请查看详细信息');
				}
			} else {
				new Notice(`已生成 HTML 文件到：${tempDir}`);
			}
		} catch (error) {
			new Notice('发布失败：' + error.message);
			console.error('发布失败：', error);
		}
	}

	generateSlug(title: string): string {
		if (!title) return '';

		// 使用正则表达式匹配英文单词和其他字符
		const words = title.match(/[A-Za-z]+|[^A-Za-z]+/g) || [];

		// 处理每个部分
		const processedWords = words.map(word => {
			// 如果是英文单词，直接返回
			if (/^[A-Za-z]+$/.test(word)) {
				return word;
			}
			// 如果包含中文字符，转换为拼音
			if (/[\u4e00-\u9fa5]/.test(word)) {
				return pinyin(word, {
					toneType: 'none',
					type: 'array'
				}).join('-');
			}
			// 其他字符（空格、标点等）转换为中划线
			return '-';
		});

		return processedWords
			.join('-')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-') // 将非字母数字字符替换为中划线
			.replace(/(^-|-$)/g, '') // 移除首尾的中划线
			.replace(/--+/g, '-') // 将多个连续的中划线替换为单个
			.replace(/^$/, 'untitled'); // 如果结果为空，使用 'untitled'
	}

	generateIndexHtml(posts: BlogPost[]): string {
		return this.templateService.generateIndexHtml({
			description: this.settings.blogDescription,
			posts: posts,
			githubUsername: this.settings.githubOwner
		});
	}

	generatePostHtml(post: BlogPost, allPosts: BlogPost[]): string {
		// 找到当前文章的索引
		const currentIndex = allPosts.findIndex(p => p.slug === post.slug);

		// 获取上一篇和下一篇文章
		const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
		const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

		return this.templateService.generatePostHtml({
			title: post.title,
			date: post.date,
			content: this.convertMarkdownToHtml(post.content),
			prevPost: prevPost ? { title: prevPost.title, slug: prevPost.slug } : null,
			nextPost: nextPost ? { title: nextPost.title, slug: nextPost.slug } : null,
			githubUsername: this.settings.githubOwner
		});
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.initGithubService();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.initGithubService();
	}

	// 添加更新 frontmatter 的方法
	async updateFrontmatter(file: TFile, newFrontmatter: any) {
		try {
			const content = await this.app.vault.read(file);
			const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
			const match = content.match(frontmatterRegex);

			if (match) {
				// 将新的 frontmatter 转换为 YAML 格式
				const yamlContent = Object.entries(newFrontmatter)
					.map(([key, value]) => {
						if (Array.isArray(value)) {
							return `${key}:\n  - ${value.join('\n  - ')}`;
						}
						return `${key}: ${value}`;
					})
					.join('\n');

				// 替换原有的 frontmatter
				const newContent = content.replace(frontmatterRegex, `---\n${yamlContent}\n---`);
				await this.app.vault.modify(file, newContent);
			} else {
				// 如果没有 frontmatter，添加一个
				const yamlContent = Object.entries(newFrontmatter)
					.map(([key, value]) => {
						if (Array.isArray(value)) {
							return `${key}:\n  - ${value.join('\n  - ')}`;
						}
						return `${key}: ${value}`;
					})
					.join('\n');
				const newContent = `---\n${yamlContent}\n---\n\n${content}`;
				await this.app.vault.modify(file, newContent);
			}
		} catch (error) {
			console.error('更新 frontmatter 失败:', error);
			throw new Error(`更新 frontmatter 失败: ${error.message}`);
		}
	}
}

class BlogSettingTab extends PluginSettingTab {
	plugin: BlogPlugin;

	constructor(app: App, plugin: BlogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('上传到 GitHub')
			.setDesc('是否将生成的文件上传到 GitHub')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.shouldUploadToGithub)
				.onChange(async (value) => {
					this.plugin.settings.shouldUploadToGithub = value;
					await this.plugin.saveSettings();
				}));

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
			.setName('GitHub 分支')
			.setDesc('指定要推送的 GitHub 分支')
			.addText(text => text
				.setPlaceholder('输入分支名称（例如：main）')
				.setValue(this.plugin.settings.githubBranch)
				.onChange(async (value) => {
					this.plugin.settings.githubBranch = value;
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
