import { Octokit } from '@octokit/rest';

export interface GithubConfig {
    token: string;
    owner: string;
    repo: string;
}

export class GithubService {
    private octokit: Octokit;
    private config: GithubConfig;

    constructor(config: GithubConfig) {
        this.config = config;
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
     * 上传文件到 GitHub
     * @param path 文件路径
     * @param content 文件内容
     * @returns 上传结果
     */
    public async uploadFile(path: string, content: string): Promise<{
        success: boolean;
        message: string;
        skipped?: boolean;
    }> {
        try {
            // 验证参数
            if (!path || path === '.html') {
                throw new Error('无效的文件名');
            }

            // 计算文件内容的 base64
            const contentBase64 = Buffer.from(content).toString('base64');

            try {
                // 尝试获取文件信息
                const { data: existingFile } = await this.octokit.repos.getContent({
                    owner: this.config.owner,
                    repo: this.config.repo,
                    path,
                });

                // 如果文件存在
                if (!Array.isArray(existingFile) && existingFile.type === 'file') {
                    // 检查内容是否相同
                    if (existingFile.content?.replace(/\n/g, '') === contentBase64) {
                        return {
                            success: true,
                            message: `文件 ${path} 内容未变化`,
                            skipped: true
                        };
                    }

                    // 更新文件
                    await this.octokit.repos.createOrUpdateFileContents({
                        owner: this.config.owner,
                        repo: this.config.repo,
                        path,
                        message: `Update ${path}`,
                        content: contentBase64,
                        sha: existingFile.sha
                    });

                    return {
                        success: true,
                        message: `文件 ${path} 更新成功`
                    };
                }
            } catch (error) {
                // 如果文件不存在，创建新文件
                if (error.status === 404) {
                    await this.octokit.repos.createOrUpdateFileContents({
                        owner: this.config.owner,
                        repo: this.config.repo,
                        path,
                        message: `Create ${path}`,
                        content: contentBase64
                    });
                    return {
                        success: true,
                        message: `文件 ${path} 创建成功`
                    };
                }

                // 如果是其他错误，重新抛出
                throw error;
            }

            return {
                success: true,
                message: `文件 ${path} 操作成功`
            };
        } catch (error) {
            console.error(`上传文件 ${path} 失败:`, error);
            return {
                success: false,
                message: error.message
            };
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

            const results = await Promise.all(
                files.map(async (file) => {
                    const result = await this.uploadFile(file.path, file.content);
                    return {
                        path: file.path,
                        ...result
                    };
                })
            );

            const allSuccess = results.every((result) => result.success);
            return {
                success: allSuccess,
                results
            };
        } catch (error) {
            return {
                success: false,
                results: [{
                    path: 'unknown',
                    success: false,
                    message: `批量上传失败: ${error.message}`
                }]
            };
        }
    }
} 