import * as Handlebars from 'handlebars';
import { FileSystemAdapter } from 'obsidian';
import { readFileSync } from 'fs';
import { join } from 'path';

interface OutlineItem {
    level: number;
    title: string;
    id: string;
    children: OutlineItem[];
}

export class TemplateService {
    private indexTemplate: Handlebars.TemplateDelegate;
    private postTemplate: Handlebars.TemplateDelegate;

    constructor(private app: any) {
        this.loadTemplates();
    }

    private loadTemplates() {
        const adapter = this.app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            throw new Error('不支持的文件系统适配器');
        }

        const basePath = adapter.getBasePath();
        const pluginPath = join(basePath, '.obsidian/plugins/obsidian-blog-publisher');
        const templatesPath = join(pluginPath, 'src/templates');

        // 加载 partial 模板
        const headerTemplateContent = readFileSync(join(templatesPath, 'partials/header.hbs'), 'utf-8');
        const footerTemplateContent = readFileSync(join(templatesPath, 'partials/footer.hbs'), 'utf-8');
        const stylesTemplateContent = readFileSync(join(templatesPath, 'partials/styles.hbs'), 'utf-8');
        
        // 注册 partial 模板
        Handlebars.registerPartial('header', headerTemplateContent);
        Handlebars.registerPartial('footer', footerTemplateContent);
        Handlebars.registerPartial('styles', stylesTemplateContent);

        // 加载主模板文件
        const indexTemplateContent = readFileSync(join(templatesPath, 'index.hbs'), 'utf-8');
        const postTemplateContent = readFileSync(join(templatesPath, 'post.hbs'), 'utf-8');

        // 编译模板
        this.indexTemplate = Handlebars.compile(indexTemplateContent);
        this.postTemplate = Handlebars.compile(postTemplateContent);
    }

    public generateIndexHtml(data: { posts: any[]; description: string; githubUsername: string }): string {
        return this.indexTemplate(data);
    }

    private extractOutline(html: string): OutlineItem[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const outline: OutlineItem[] = [];
        const stack: OutlineItem[] = [];

        headings.forEach((heading) => {
            const level = parseInt(heading.tagName[1]);
            const title = heading.textContent || '';
            const id = heading.id || this.generateId(title);

            const item: OutlineItem = {
                level,
                title,
                id,
                children: []
            };

            while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }

            if (stack.length === 0) {
                outline.push(item);
            } else {
                stack[stack.length - 1].children.push(item);
            }

            stack.push(item);
        });

        return outline;
    }

    private generateId(title: string): string {
        if (!title) return 'untitled';
        
        // 移除 HTML 标签
        title = title.replace(/<[^>]+>/g, '');
        
        // 生成基础 ID
        let id = title
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
            .replace(/(^-|-$)/g, '');
            
        // 如果 ID 为空，使用时间戳
        if (!id) {
            id = `heading-${Date.now()}`;
        }
        
        return id;
    }

    public generatePostHtml(data: { 
        title: string; 
        date: string; 
        content: string;
        prevPost: { title: string; slug: string } | null;
        nextPost: { title: string; slug: string } | null;
        githubUsername: string;
    }): string {
        // 提取大纲
        const outline = this.extractOutline(data.content);
        
        // 为每个标题添加 id
        const contentWithIds = data.content.replace(
            /<h([1-6])>(.*?)<\/h\1>/g,
            (match, level, title) => {
                const id = this.generateId(title);
                return `<h${level} id="${id}">${title}</h${level}>`;
            }
        );

        return this.postTemplate({
            ...data,
            content: contentWithIds,
            outline
        });
    }
} 