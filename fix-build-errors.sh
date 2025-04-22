#!/bin/bash
# 修复Vercel部署错误的脚本

echo "开始修复Vercel构建错误..."

# 1. 修复 ControlPanel.tsx 中未使用的 isGenerating 变量
sed -i 's/isGenerating: boolean/_isGenerating: boolean/' src/components/ControlPanel.tsx
sed -i 's/isGenerating,/_isGenerating: isGenerating,/' src/components/ControlPanel.tsx

# 2. 修复 Piano.tsx 中未使用的 noteFreq 变量
sed -i 's/const noteFreq = NOTES\[noteName as keyof typeof NOTES\];//g' src/components/Piano.tsx

# 3. 修复 Player.tsx 中不兼容的 responsive 属性
sed -i 's/responsive: true,//g' src/components/Player.tsx

# 4. 创建或更新 vite-env.d.ts 文件，修复 import.meta.env 类型问题
cat > src/vite-env.d.ts << EOL
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUNO_API_KEY: string;
  readonly VITE_SUNO_CALLBACK: string;
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
EOL

echo "所有错误修复完成！" 