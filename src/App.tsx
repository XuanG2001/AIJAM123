import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import Piano from './components/Piano'
import DrumPad from './components/DrumPad'
import ControlPanel from './components/ControlPanel'
import Player from './components/Player'
import { InstrumentType } from './types'

function App() {
  const [activeInstrument, setActiveInstrument] = useState<InstrumentType>('piano')
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // 添加加载状态管理
  useEffect(() => {
    try {
      console.log("App组件加载中...");
      // 模拟组件初始化
      setTimeout(() => {
        setIsLoading(false);
        console.log("App组件加载完成");
      }, 1000);
    } catch (error) {
      console.error("App加载错误:", error);
      setLoadingError(error instanceof Error ? error.message : "未知错误");
      setIsLoading(false);
    }
  }, []);

  // 如果处于加载状态，显示加载指示器
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-jam-primary">AI Jam Playground</h1>
          <p className="text-muted-foreground">正在加载应用...</p>
          <div className="mt-4 h-2 w-64 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-jam-primary animate-pulse rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // 如果发生错误，显示错误信息
  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md border border-red-300 rounded-lg bg-red-50">
          <h1 className="text-2xl font-bold mb-4 text-red-600">加载失败</h1>
          <p className="text-gray-700">{loadingError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 始终显示的静态内容 */}
      <div id="static-content" style={{display: 'none'}}>
        <h1>AI Jam Playground</h1>
        <p>如果您能看到这个内容，说明页面基本结构已加载。</p>
      </div>

      <div className="min-h-screen flex flex-col">
        <header className="container mx-auto py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-jam-primary text-3xl">🎵</span>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-jam-primary to-purple-300 bg-clip-text text-transparent">
              AI Jam Playground
            </h1>
          </div>
        </header>

        <main className="container mx-auto flex-1 py-4 flex flex-col md:flex-row gap-6">
          <div className="md:w-2/3">
            <Tabs
              defaultValue="piano"
              onValueChange={(value) => setActiveInstrument(value as InstrumentType)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="piano">
                  <span className="mr-2">🎹</span> 钢琴键盘
                </TabsTrigger>
                <TabsTrigger value="drum">
                  <span className="mr-2">🥁</span> 架子鼓
                </TabsTrigger>
              </TabsList>
              <TabsContent value="piano" className="mt-4">
                <Piano />
              </TabsContent>
              <TabsContent value="drum" className="mt-4">
                <DrumPad />
              </TabsContent>
            </Tabs>
          </div>

          <div className="md:w-1/3">
            <ControlPanel 
              activeInstrument={activeInstrument}
              _isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
              setAudioUrl={setAudioUrl}
            />
          </div>
        </main>

        <footer className="border-t border-border">
          <div className="container mx-auto py-4">
            <Player 
              audioUrl={audioUrl} 
              isGenerating={isGenerating}
            />
          </div>
        </footer>
      </div>
    </>
  )
}

export default App 