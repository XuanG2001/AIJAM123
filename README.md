# AI Jam Playground 🎵

AI Jam Playground 是一个交互式音乐创作平台，允许用户通过钢琴键盘或架子鼓（暂未开放）即兴创作旋律，并通过 Suno AI 生成高质量的音乐片段。该应用程序专为音乐爱好者设计，无需专业音乐理论知识即可完成音乐创作。

## ✨ 主要功能

- **多种创作入口**：通过钢琴键盘 (使用计算机键盘 A-S-D-F-G-H-J / W-E-T-Y-U) 或架子鼓 (数字键 1-9，暂未开放) 创作旋律
- **AI 音乐生成**：调用 Suno API 根据演奏的音符生成 15-30 秒的音乐
- **丰富的自定义选项**：调整音乐风格、模型版本、速度、是否纯伴奏等
- **直观的音乐可视化**：暂未开放
- **音乐下载**：一键下载生成的音乐为，MP3 格式
- **深色霓虹 UI**：赏心悦目的深色界面和霓虹灯效果
- **响应式设计**：适配桌面和移动设备的界面布局
- **PWA 支持**：可作为渐进式 Web 应用安装到设备上，支持离线演奏

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript + Vite
- **样式**：TailwindCSS + shadcn/ui
- **音频处理**：Tone.js (本地合成) + wavesurfer.js (波形显示，暂未开放)
- **状态管理**：Zustand
- **后端代理**：Netlify Functions
- **部署**：Netlify

## 📦 本地开发

### 先决条件

- Node.js 16.x 或更高版本
- Suno API 密钥 (本demo使用了suno国内替代：https://sunoapi.org/)

### 安装步骤

1. 克隆仓库
   ```bash
   git clone https://github.com/yourusername/ai-jam-playground.git
   cd ai-jam-playground
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 配置环境变量
   ```bash
   cp .env.example .env
   ```
   编辑 `.env` 文件，添加你的 Suno API 密钥：
   ```
   VITE_SUNO_API_KEY=your_suno_api_key_here
   VITE_SUNO_CALLBACK=http://localhost:3000/api/suno-callback
   ```

4. 启动开发服务器
   ```bash
   npm run dev
   ```

5. 浏览器中打开 [http://localhost:5173](http://localhost:5173)

## 🚀 部署到 Netlify

1. Fork 本仓库到你的 GitHub 账户

2. 在 [Netlify](https://netlify.com) 创建一个新项目并导入你的 GitHub 仓库

3. 在项目设置中添加以下环境变量：
   - `VITE_SUNO_API_KEY`: 你的 Suno API 密钥
   - `VITE_SUNO_CALLBACK`: 你的 Netlify 部署 URL + `/.netlify/functions/suno-callback` (例如: `https://your-project.netlify.app/.netlify/functions/suno-callback`)

4. 确保项目已正确配置Netlify函数：
   - 函数位于 `netlify/functions/` 目录
   - netlify.toml 文件中配置了正确的重定向规则

5. 完成并部署

## 🚀 部署到 Vercel

1. Fork 本仓库到你的 GitHub 账户

2. 在 [Vercel](https://vercel.com) 创建一个新项目并导入你的 GitHub 仓库

3. 在项目设置中添加以下环境变量：
   - `VITE_SUNO_API_KEY`: 你的 Suno API 密钥
   - `VITE_SUNO_CALLBACK`: 你的 Vercel 部署 URL + `/api/suno-callback` (例如: `https://your-project.vercel.app/api/suno-callback`)

4. 完成并部署

## 📝 使用说明

1. **选择乐器**：在顶部标签页中选择钢琴键盘或架子鼓
2. **即兴演奏**：使用键盘弹奏音符 (钢琴模式使用 A-S-D-F-G-H-J / W-E-T-Y-U，架子鼓模式暂未开放)
3. **录制旋律**：点击"开始录制"按钮或按下"R"键开始录制，按"S"键停止
4. **设置参数**：在控制面板中填写音乐描述、调整风格、速度等参数
5. **生成音乐**：点击"生成AI音乐"按钮
6. **试听与下载**：生成完成后播放音乐并下载 MP3 文件

## 🔄 API 代理说明

本项目使用 Netlify Functions 代理 Suno API 请求。



## 📄 许可证

MIT 
