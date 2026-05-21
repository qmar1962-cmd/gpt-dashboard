// GitHub API 基础配置
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OWNER = 'qmar1962-cmd';
const GITHUB_REPO = 'gpt-dashboard';
const GITHUB_BRANCH = 'master';

// 从环境变量获取 GitHub Token
const getGitHubToken = () => {
  return import.meta.env.VITE_GITHUB_TOKEN || '';
};

// GitHub API 请求封装
async function githubRequest(method: string, path: string, data?: any): Promise<any> {
  const token = getGitHubToken();
  
  if (!token) {
    throw new Error('未配置 GitHub Token，请在 .env.local 中设置 VITE_GITHUB_TOKEN');
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`;
  
  const headers: Record<string, string> = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (data && (method === 'PUT' || method === 'POST' || method === 'DELETE')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API ${response.status}: ${errorText}`);
  }

  // DELETE 请求可能没有响应体
  if (method === 'DELETE' && response.status === 204) {
    return null;
  }

  return response.json();
}

// ========== GitHub 远端文件操作 API ==========

// 列出远端文件
export const listRemoteFiles = async () => {
  const data = await githubRequest('GET', '/contents/public/database');
  
  // 过滤掉 filelist.json，只返回数据文件
  const files = data.filter((file: any) => file.name !== 'filelist.json');
  
  return {
    success: true,
    files: files.map((file: any) => ({
      name: file.name,
      path: file.path,
      size: file.size,
      sha: file.sha,
      download_url: file.download_url,
      html_url: file.html_url,
      mtime: file.mtime || new Date().toISOString()
    }))
  };
};

// 获取文件内容
export const getRemoteFileContent = async (fileName: string) => {
  const data = await githubRequest('GET', `/contents/public/database/${fileName}`);
  
  return {
    success: true,
    file: {
      name: data.name,
      content: data.content, // base64 encoded
      encoding: data.encoding,
      size: data.size,
      sha: data.sha
    }
  };
};

// 更新 filelist.json
export const updateRemoteFilelist = async () => {
  // 1. 获取所有文件
  const listData = await githubRequest('GET', '/contents/public/database');
  
  // 2. 过滤出数据文件（排除 filelist.json 和 data.json）
  const dataFiles = listData.filter((file: any) => 
    file.name !== 'filelist.json' && file.name !== 'data.json'
  );
  
  // 3. 创建 filelist.json 内容
  const filelist = {
    generated_at: new Date().toISOString(),
    files: {}
  };
  
  // 4. 为每个文件设置 mtime 和 size
  dataFiles.forEach((file: any) => {
    filelist.files[file.name] = {
      mtime: new Date().toISOString(),
      size: file.size
    };
  });
  
  // 5. 获取现有的 filelist.json（如果有）
  let filelistSha = null;
  try {
    const existingFilelist = await githubRequest('GET', '/contents/public/database/filelist.json');
    filelistSha = existingFilelist.sha;
  } catch (e) {
    // filelist.json 不存在，忽略
  }
  
  // 6. 上传/更新 filelist.json
  const filelistContent = btoa(unescape(encodeURIComponent(JSON.stringify(filelist, null, 2))));
  
  await githubRequest('PUT', '/contents/public/database/filelist.json', {
    message: 'Update filelist.json',
    content: filelistContent,
    sha: filelistSha,
    branch: GITHUB_BRANCH
  });
  
  return { success: true };
};

// 上传文件到远端（fileContent 应为 base64 编码的字符串）
export const uploadRemoteFile = async (fileName: string, fileContent: string, message?: string) => {
  // 1. 上传文件
  await githubRequest('PUT', `/contents/public/database/${fileName}`, {
    message: message || `Upload ${fileName}`,
    content: fileContent,
    branch: GITHUB_BRANCH
  });
  
  // 2. 更新 filelist.json
  await updateRemoteFilelist();
  
  return { success: true, message: '文件上传成功' };
};

// 删除远端文件
export const deleteRemoteFile = async (fileName: string, message?: string) => {
  // 1. 获取文件 SHA
  const fileData = await githubRequest('GET', `/contents/public/database/${fileName}`);
  const fileSha = fileData.sha;
  
  // 2. 删除文件
  await githubRequest('DELETE', `/contents/public/database/${fileName}`, {
    message: message || `Delete ${fileName}`,
    sha: fileSha,
    branch: GITHUB_BRANCH
  });
  
  // 3. 更新 filelist.json
  await updateRemoteFilelist();
  
  return { success: true, message: '文件删除成功' };
};

// 辅助函数：将 File 对象转换为 base64 编码的字符串
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};
