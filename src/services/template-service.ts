import * as Handlebars from 'handlebars';
import { FileSystemAdapter } from 'obsidian';
import { readFileSync } from 'fs';
import { join } from 'path';

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

    public generatePostHtml(data: { 
        title: string; 
        date: string; 
        content: string;
        prevPost: { title: string; slug: string } | null;
        nextPost: { title: string; slug: string } | null;
        githubUsername: string;
    }): string {
        return this.postTemplate(data);
    }
} 