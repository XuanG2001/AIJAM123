import React, { ErrorInfo, Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { Toaster } from './components/ui/toaster'

// 添加错误边界组件
class ErrorBoundary extends Component<
  { children: React.ReactNode }, 
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React错误:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          margin: '20px', 
          backgroundColor: '#fff1f0', 
          color: '#ff4d4f',
          border: '1px solid #ffccc7',
          borderRadius: '4px'
        }}>
          <h2>应用出错了</h2>
          <p>抱歉，应用加载时出现了问题。请尝试刷新页面。</p>
          <details>
            <summary>错误详情</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              backgroundColor: '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 添加一个调试信息元素
const debugStyle = {
  position: 'fixed',
  bottom: '10px',
  right: '10px',
  padding: '5px',
  backgroundColor: 'rgba(0,0,0,0.7)',
  color: 'white',
  fontSize: '12px',
  zIndex: 9999,
  borderRadius: '4px'
};

// 记录页面已开始加载
console.log("应用开始加载", new Date().toISOString());

// 添加调试信息到DOM
const debugElement = document.createElement('div');
debugElement.id = 'debug-info';
Object.assign(debugElement.style, debugStyle);
debugElement.textContent = '页面正在加载...';
document.body.appendChild(debugElement);

// 更新加载状态
window.addEventListener('load', () => {
  const el = document.getElementById('debug-info');
  if (el) el.textContent = '页面已加载 ' + new Date().toISOString();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>
  </React.StrictMode>,
); 