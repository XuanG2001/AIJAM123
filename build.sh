#!/bin/bash
# 自定义构建脚本，用于解决权限问题

echo "开始构建过程..."

# 确保 TypeScript 和 Vite 可执行
chmod +x ./node_modules/.bin/tsc
chmod +x ./node_modules/.bin/vite

# 运行 TypeScript 编译
./node_modules/.bin/tsc || npx tsc
echo "TypeScript 编译完成"

# 运行 Vite 构建
./node_modules/.bin/vite build || npx vite build
echo "Vite 构建完成" 