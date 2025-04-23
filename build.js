import { build } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 确保有正确的Node.js环境
if (!globalThis.crypto) {
  try {
    // Node.js < 19 需要显式引入crypto模块
    const { webcrypto } = await import('node:crypto');
    globalThis.crypto = webcrypto;
  } catch (e) {
    console.error('无法加载crypto模块:', e);
    console.log('请确保使用Node.js 18+版本');
    process.exit(1);
  }
}

// 运行Vite构建
try {
  console.log('开始构建项目...');
  await build({
    configFile: resolve(__dirname, 'vite.config.ts'),
    root: __dirname
  });
  console.log('项目构建成功！');
} catch (e) {
  console.error('构建失败:', e);
  process.exit(1);
} 