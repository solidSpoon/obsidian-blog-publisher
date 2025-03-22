// 博客列表页模板
export const INDEX_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>solidSpoon's Blog</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.5;
            max-width: 1012px;
            margin: 0 auto;
            padding: 40px 16px;
            background-color: #ffffff;
            color: #24292f;
        }
        .header {
            text-align: left;
            margin-bottom: 40px;
            padding-bottom: 24px;
            border-bottom: 1px solid #d0d7de;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            color: #24292f;
        }
        .header .motto {
            color: #57606a;
            margin-top: 4px;
            font-size: 14px;
        }
        .post-item {
            margin-bottom: 16px;
            padding: 16px;
            background: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            transition: border-color 0.2s ease;
        }
        .post-item:hover {
            border-color: #0969da;
        }
        .post-item h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 600;
        }
        .post-date {
            color: #57606a;
            font-size: 12px;
        }
        a {
            color: #0969da;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>solidSpoon</h1>
        <div class="motto">方向是比速度更重要的追求</div>
    </div>
    <div class="posts">
        {{#each posts}}
        <div class="post-item">
            <h2><a href="{{this.slug}}.html">{{this.title}}</a></h2>
            <div class="post-date">{{this.date}}</div>
        </div>
        {{/each}}
    </div>
</body>
</html>`;

// 博客文章页模板
export const POST_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{title}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.5;
            max-width: 1012px;
            margin: 0 auto;
            padding: 40px 16px;
            color: #24292f;
        }
        .header {
            text-align: center;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid #d0d7de;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        .post-date {
            color: #57606a;
            font-size: 14px;
            margin-top: 8px;
        }
        .content {
            font-size: 16px;
            line-height: 1.5;
        }
        .back-link {
            display: inline-block;
            margin-top: 32px;
            color: #0969da;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link:hover {
            text-decoration: underline;
        }
        
        /* GitHub 风格的内容样式 */
        .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        .content h1 {
            font-size: 2em;
            border-bottom: 1px solid #d0d7de;
            padding-bottom: 0.3em;
        }
        .content h2 {
            font-size: 1.5em;
            border-bottom: 1px solid #d0d7de;
            padding-bottom: 0.3em;
        }
        .content p {
            margin-bottom: 16px;
        }
        .content code {
            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
            font-size: 85%;
            margin: 0;
            padding: 0.2em 0.4em;
            border-radius: 6px;
            background-color: rgba(175,184,193,0.2);
        }
        .content pre {
            margin-bottom: 16px;
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
            background-color: #f6f8fa;
            border-radius: 6px;
            border: 1px solid #d0d7de;
        }
        .content pre code {
            padding: 0;
            margin: 0;
            background-color: transparent;
            border: 0;
            white-space: pre;
            word-break: normal;
            overflow: visible;
            line-height: inherit;
        }
        .content img {
            max-width: 100%;
            height: auto;
            border-style: none;
            box-sizing: content-box;
        }
        .content ul, .content ol {
            margin-top: 0;
            margin-bottom: 16px;
            padding-left: 2em;
        }
        .content blockquote {
            margin: 0 0 16px;
            padding: 0 1em;
            color: #57606a;
            border-left: 0.25em solid #d0d7de;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{title}}</h1>
        <div class="post-date">{{date}}</div>
    </div>
    <div class="content">
        {{{content}}}
    </div>
    <a href="index.html" class="back-link">← 返回首页</a>
</body>
</html>`; 