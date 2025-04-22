const { execSync } = require('child_process');
const path = require('path');

console.log('开始构建过程...');

try {
  // 在Windows和Unix系统上都能正常工作的路径
  const nodeModulesBin = path.join('node_modules', '.bin');
  
  // 执行TypeScript编译
  console.log('执行TypeScript编译...');
  execSync(`node ${path.join(nodeModulesBin, 'tsc')}`, { stdio: 'inherit' });
  console.log('TypeScript编译完成');
  
  // 执行Vite构建
  console.log('执行Vite构建...');
  execSync(`node ${path.join(nodeModulesBin, 'vite')} build`, { stdio: 'inherit' });
  console.log('Vite构建完成');
  
  console.log('构建过程成功完成!');
} catch (error) {
  console.error('构建过程中出现错误:', error.message);
  process.exit(1);
} 