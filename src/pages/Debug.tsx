import { useState, useEffect } from 'react';

const DebugPage = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string>('未测试');

  // 从netlify函数获取调试信息
  const fetchDebugInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/.netlify/functions/debug');
      
      if (!response.ok) {
        throw new Error(`状态码 ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDebugInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 测试API连接
  const testApiConnection = async () => {
    try {
      setApiStatus('测试中...');
      
      const isNetlify = window.location.host.includes('netlify.app') || 
                      process.env.NODE_ENV === 'production';
      
      const apiPath = isNetlify ? '/.netlify/functions/generate' : '/api/v1/generate';
      
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // 发送最小请求，预期会失败但可以验证连通性
          test: true
        })
      });
      
      const data = await response.json();
      setApiStatus(`已连接 (${response.status}): ${data.message || '无消息'}`);
    } catch (err) {
      setApiStatus(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 获取环境变量信息
  const getEnvInfo = () => {
    return {
      NODE_ENV: process.env.NODE_ENV || '未定义',
      VITE_SUNO_API_KEY: import.meta.env.VITE_SUNO_API_KEY ? '已设置' : '未设置',
      VITE_SUNO_CALLBACK: import.meta.env.VITE_SUNO_CALLBACK || '未设置',
      IS_NETLIFY: window.location.host.includes('netlify.app') ? '是' : '否',
      CURRENT_URL: window.location.href
    };
  };

  // 初始加载时获取信息
  useEffect(() => {
    fetchDebugInfo();
  }, []);

  return (
    <div className="p-6 bg-card rounded-lg border border-border">
      <h1 className="text-2xl font-bold mb-4">系统诊断</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">前端环境</h2>
        <pre className="bg-muted p-4 rounded-md overflow-auto">
          {JSON.stringify(getEnvInfo(), null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">API连接测试</h2>
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={testApiConnection}
            className="px-4 py-2 bg-jam-primary rounded-md text-white"
          >
            测试API连接
          </button>
          <span>{apiStatus}</span>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Netlify函数诊断</h2>
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={fetchDebugInfo}
            className="px-4 py-2 bg-jam-primary rounded-md text-white"
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新诊断信息'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {debugInfo && (
          <pre className="bg-muted p-4 rounded-md overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        )}
      </div>
      
      <div className="mt-8">
        <a href="/" className="text-jam-primary hover:underline">
          返回主页
        </a>
      </div>
    </div>
  );
};

export default DebugPage; 