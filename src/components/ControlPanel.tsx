import { useEffect } from 'react';
import { InstrumentType } from '@/types';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import useJamStore from '@/store/useJamStore';
import useSuno from '@/hooks/useSuno';
import { toast } from '@/hooks/use-toast';
import { Loader2, Music, Download } from 'lucide-react';

interface ControlPanelProps {
  activeInstrument: InstrumentType;
  _isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  setAudioUrl: (url: string | null) => void;
}

const ControlPanel = ({
  activeInstrument,
  _isGenerating,
  setIsGenerating,
  setAudioUrl
}: ControlPanelProps) => {
  const { 
    customMode, 
    setCustomMode,
    instrumental, 
    setInstrumental,
    model, 
    setModel,
    prompt, 
    setPrompt,
    style, 
    setStyle,
    title, 
    setTitle,
    tags, 
    setTags,
    tempo, 
    setTempo,
    getGenerateParams,
    clearNotes,
    recordedNotes
  } = useJamStore();
  
  const { generate, loading, error, audioUrl: generatedUrl, progress } = useSuno();
  
  useEffect(() => {
    if (generatedUrl) {
      setAudioUrl(generatedUrl);
    }
  }, [generatedUrl, setAudioUrl]);
  
  useEffect(() => {
    if (error) {
      toast({
        title: '错误',
        description: error,
        variant: 'destructive'
      });
    }
  }, [error]);
  
  const handleGenerate = async () => {
    if (loading) return;
    
    try {
      setIsGenerating(true);
      
      if (!customMode && !prompt) {
        toast({
          title: '提示',
          description: '请输入提示词描述',
          variant: 'destructive'
        });
        setIsGenerating(false);
        return;
      }
      
      if (customMode && (!style || !title)) {
        toast({
          title: '提示',
          description: '自定义模式下，风格和标题为必填项',
          variant: 'destructive'
        });
        setIsGenerating(false);
        return;
      }
      
      if (recordedNotes.length === 0) {
        toast({
          title: '提示',
          description: '请先演奏一些音符',
        });
      }
      
      const params = getGenerateParams(activeInstrument);
      await generate(params);
      
      clearNotes();
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">控制面板</h2>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="customMode">自定义模式</Label>
            <div className="text-sm text-muted-foreground">
              直接指定风格和标题
            </div>
          </div>
          <Switch
            id="customMode"
            checked={customMode}
            onCheckedChange={setCustomMode}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="instrumental">纯音乐</Label>
            <div className="text-sm text-muted-foreground">
              只生成伴奏，无人声
            </div>
          </div>
          <Switch
            id="instrumental"
            checked={instrumental}
            onCheckedChange={setInstrumental}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="model">模型</Label>
          <div className="flex space-x-2">
            <button 
              className={`flex-1 py-2 px-3 rounded-md ${model === 'V3_5' ? 'bg-jam-primary text-white' : 'bg-muted'}`}
              onClick={() => setModel('V3_5')}
            >
              Suno V3.5
            </button>
            <button 
              className={`flex-1 py-2 px-3 rounded-md ${model === 'V4' ? 'bg-jam-primary text-white' : 'bg-muted'}`}
              onClick={() => setModel('V4')}
            >
              Suno V4
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="prompt">音乐描述 {!customMode && <span className="text-destructive">*</span>}</Label>
          <Textarea 
            id="prompt"
            placeholder="描述您想要的音乐风格、情绪和元素..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[80px] resize-y"
          />
          <div className="text-xs text-muted-foreground">
            最多400字符，当前: {prompt.length}/400
          </div>
        </div>
        
        {customMode && (
          <>
            <div className="space-y-2">
              <Label htmlFor="style">风格 <span className="text-destructive">*</span></Label>
              <Input
                id="style"
                placeholder="例如：lofi hiphop, cinematic, jazz..."
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                最多200字符，当前: {style.length}/200
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">标题 <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="为您的音乐取个名字"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                最多80字符，当前: {title.length}/80
              </div>
            </div>
          </>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="tags">标签（可选）</Label>
          <Input
            id="tags"
            placeholder="用逗号分隔，例如：relax,chill,ambient"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="tempo">速度: {tempo} BPM</Label>
          </div>
          <Slider
            id="tempo"
            min={40}
            max={200}
            step={1}
            value={[tempo]}
            onValueChange={(value) => setTempo(value[0])}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>慢</span>
            <span>快</span>
          </div>
        </div>
        
        <button
          className="generate-btn w-full mt-6 flex items-center justify-center gap-2"
          disabled={loading}
          onClick={handleGenerate}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中 ({Math.round(progress)}%)
            </>
          ) : (
            <>
              <Music className="h-4 w-4" />
              生成AI音乐
            </>
          )}
        </button>
        
        {generatedUrl && (
          <div className="flex justify-center mt-2">
            <a 
              href={generatedUrl} 
              download="ai-jam-music.mp3"
              className="text-sm text-jam-primary flex items-center gap-1 hover:underline"
            >
              <Download className="h-3 w-3" /> 下载MP3
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel; 