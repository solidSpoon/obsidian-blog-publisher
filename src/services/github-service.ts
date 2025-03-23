import { Octokit } from '@octokit/rest';

export interface GithubConfig {
    token: string;
    owner: string;
    repo: string;
    branch?: string;
}

export class GithubService {
    private octokit: Octokit;
    private config: GithubConfig;

    constructor(config: GithubConfig) {
        this.config = {
            ...config,
            branch: config.branch || 'main' // 默认使用 main 分支
        };
        this.octokit = new Octokit({
            auth: config.token
        });
    }

    /**
     * 验证 GitHub 配置是否有效
     */
    public validateConfig(): void {
        if (!this.config.token || !this.config.repo || !this.config.owner) {
            throw new Error('请先在设置中配置 GitHub Token、仓库名和用户名');
        }
    }

    /**
     * 批量上传文件到 GitHub
     * @param files 文件列表，每个文件包含路径和内容
     * @returns 上传结果列表
     */
    public async uploadFiles(files: { path: string; content: string }[]): Promise<{
        success: boolean;
        results: {
            path: string;
            success: boolean;
            message: string;
            skipped?: boolean;
        }[];
    }> {
        try {
            this.validateConfig();

            // 获取最新的 commit
            const { data: ref } = await this.octokit.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${this.config.branch}`
            });

            const { data: commit } = await this.octokit.git.getCommit({
                owner: this.config.owner,
                repo: this.config.repo,
                commit_sha: ref.object.sha
            });

            // 获取当前的树
            const { data: currentTree } = await this.octokit.git.getTree({
                owner: this.config.owner,
                repo: this.config.repo,
                tree_sha: commit.tree.sha
            });

            // 准备新的树
            const newTree = await this.octokit.git.createTree({
                owner: this.config.owner,
                repo: this.config.repo,
                base_tree: currentTree.sha,
                tree: files.map(file => ({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    content: file.content
                }))
            });

            // 创建新的提交
            const { data: newCommit } = await this.octokit.git.createCommit({
                owner: this.config.owner,
                repo: this.config.repo,
                message: `Update ${files.length} files`,
                tree: newTree.data.sha,
                parents: [commit.sha]
            });

            // 更新引用
            await this.octokit.git.updateRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${this.config.branch}`,
                sha: newCommit.sha
            });

            return {
                success: true,
                results: files.map(file => ({
                    path: file.path,
                    success: true,
                    message: '文件更新成功'
                }))
            };
        } catch (error) {
            console.error('批量上传文件失败:', error);
            return {
                success: false,
                results: files.map(file => ({
                    path: file.path,
                    success: false,
                    message: `上传失败: ${error.message}`
                }))
            };
        }
    }

    /**
     * 上传单个文件到 GitHub（保留此方法以兼容现有代码）
     */
    public async uploadFile(path: string, content: string): Promise<{
        success: boolean;
        message: string;
        skipped?: boolean;
    }> {
        return this.uploadFiles([{ path, content }]).then(result => {
            return result.results[0];
        });
    }
} 