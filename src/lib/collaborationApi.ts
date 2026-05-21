// GitHub 协作数据读写 API
// 用于排休计划、未出勤原因、中心元数据等协作字段的远端存储

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const GITHUB_OWNER = 'qmar1962-cmd';
const GITHUB_REPO = 'gpt-dashboard';
const GITHUB_BRANCH = 'master';
const DATA_DIR = 'public/database';

// 从环境变量获取 GitHub Token
const getGitHubToken = () => {
  return import.meta.env.VITE_GITHUB_TOKEN || '';
};

// 协作数据文件缓存（避免重复读取）
const collaborationCache: Record<string, { data: any; sha: string; timestamp: number }> = {};
const CACHE_TTL = 30000; // 30秒缓存

/**
 * 加载协作数据（优先从远端读取，失败则返回空对象）
 * @param fileName 文件名，如 'leave_plans.json'
 * @returns 解析后的 JSON 数据
 */
export async function loadCollaborationData(fileName: string): Promise<any> {
  // 检查缓存
  const cached = collaborationCache[fileName];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[协作数据] 使用缓存: ${fileName}`);
    return cached.data;
  }

  try {
    // 通过 GitHub API 读取（可以获取 sha）
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_DIR}/${fileName}?ref=${GITHUB_BRANCH}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(getGitHubToken() ? { 'Authorization': `token ${getGitHubToken()}` } : {})
      }
    });

    if (response.status === 404) {
      console.log(`[协作数据] 文件不存在，返回空对象: ${fileName}`);
      collaborationCache[fileName] = { data: {}, sha: '', timestamp: Date.now() };
      return {};
    }

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    }

    const fileData = await response.json();
    const content = JSON.parse(atob(fileData.content.replace(/\s/g, '')));

    // 更新缓存
    collaborationCache[fileName] = {
      data: content,
      sha: fileData.sha,
      timestamp: Date.now()
    };

    console.log(`[协作数据] 加载成功: ${fileName}`);
    return content;
  } catch (error) {
    console.error(`[协作数据] 加载失败 ${fileName}:`, error);
    // 降级到空对象
    return {};
  }
}

/**
 * 保存协作数据到 GitHub
 * @param fileName 文件名，如 'leave_plans.json'
 * @param data 要保存的数据对象
 * @param message 提交信息
 * @returns 保存结果
 */
export async function saveCollaborationData(
  fileName: string,
  data: any,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const token = getGitHubToken();

  if (!token) {
    return { success: false, error: '未配置 GitHub Token，无法保存协作数据' };
  }

  try {
    // 1. 获取现有文件的 sha（如果存在）
    let sha: string | undefined;
    const cached = collaborationCache[fileName];

    if (cached && cached.sha) {
      sha = cached.sha;
    } else {
      try {
        const checkUrl = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_DIR}/${fileName}?ref=${GITHUB_BRANCH}`;
        const checkResponse = await fetch(checkUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (checkResponse.ok) {
          const fileInfo = await checkResponse.json();
          sha = fileInfo.sha;
        }
      } catch {
        // 文件不存在，不需要 sha
      }
    }

    // 2. 编码内容
    const contentStr = JSON.stringify(data, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

    // 3. 上传文件
    const putUrl = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_DIR}/${fileName}`;
    const putBody: any = {
      message,
      content: contentBase64,
      branch: GITHUB_BRANCH
    };
    if (sha) {
      putBody.sha = sha;
    }

    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();

      // 409 冲突：文件已被其他人修改
      if (putResponse.status === 409) {
        return {
          success: false,
          error: '文件已被其他人修改，请刷新页面后重试'
        };
      }

      throw new Error(`GitHub API ${putResponse.status}: ${errorText}`);
    }

    const result = await putResponse.json();

    // 4. 更新缓存
    collaborationCache[fileName] = {
      data: { ...data },
      sha: result.content?.sha || '',
      timestamp: Date.now()
    };

    console.log(`[协作数据] 保存成功: ${fileName}`);
    return { success: true };
  } catch (error) {
    console.error(`[协作数据] 保存失败 ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存失败'
    };
  }
}

/**
 * 清除协作数据缓存
 */
export function clearCollaborationCache(fileName?: string) {
  if (fileName) {
    delete collaborationCache[fileName];
  } else {
    Object.keys(collaborationCache).forEach(key => delete collaborationCache[key]);
  }
}

/**
 * 获取缓存的 sha（用于乐观锁）
 */
export function getCollaborationSha(fileName: string): string | undefined {
  return collaborationCache[fileName]?.sha;
}
