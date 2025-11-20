import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Settings2, 
  History, 
  Download, 
  Share2, 
  Zap, 
  Trash2,
  Loader2,
  Type,
  PenTool,
  Camera,
  Wand2,
  Palette,
  Banana,
  CloudRain,
  Code2,
  Aperture,
  MonitorPlay,
  Smartphone,
  Home,
  Trophy,
  User,
  Heart,
  Eye,
  Crown,
  Copy,
  Search,
  X,
  Atom,
  Settings, 
  Edit,     
  Users     
} from 'lucide-react';

// --- КОНФИГУРАЦИЯ И MOCK ДАННЫЕ ---

const tg = window.Telegram?.WebApp || { 
  ready: () => {}, 
  expand: () => {}, 
  MainButton: { show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {}, offClick: () => {}, showProgress: () => {}, hideProgress: () => {} },
  HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
  themeParams: { bg_color: '#000000', text_color: '#ffffff', button_color: '#6366f1', button_text_color: '#ffffff' }
};

const MODELS = [
  { id: 'nanobanana', name: 'NanoBanana', type: 'New', icon: <Banana size={20} />, desc: 'Топ 2025', color: 'from-yellow-400 to-orange-500', supportedRatios: ['1:1', '16:9', '9:16', '4:5'] },
  { id: 'seedream', name: 'Seedream 4', type: 'Art', icon: <CloudRain size={20} />, desc: 'Сюрреализм', color: 'from-purple-400 to-fuchsia-500', supportedRatios: ['1:1', '3:4', '4:5', '9:16'] },
  { id: 'qwen', name: 'Qwen Edit', type: 'Edit', icon: <Code2 size={20} />, desc: 'Точность', color: 'from-emerald-400 to-teal-500', supportedRatios: ['1:1', '16:9'] },
  { id: 'flux', name: 'Flux 1.1', type: 'Real', icon: <Aperture size={20} />, desc: 'Фотореализм', color: 'from-blue-400 to-indigo-500', supportedRatios: ['1:1', '16:9', '21:9', '9:16'] },
];

const RATIOS = [
  { id: '1:1', label: '1:1', width: 1024, height: 1024, icon: 'Square', desc: 'Квадрат' },
  { id: '16:9', label: '16:9', width: 1280, height: 720, icon: 'RectangleHorizontal', desc: 'YouTube' },
  { id: '21:9', label: '21:9', width: 1536, height: 640, icon: 'MonitorPlay', desc: 'Кино' },
  { id: '9:16', label: '9:16', width: 720, height: 1280, icon: 'RectangleVertical', desc: 'Stories' },
  { id: '3:4', label: '3:4', width: 896, height: 1152, icon: 'Portrait', desc: 'Фото' },
  { id: '4:5', label: '4:5', width: 1080, height: 1350, icon: 'Smartphone', desc: 'Пост' },
];

const MOCK_FEED = [
  { id: 1, author: 'AlexCyber', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', likes: 1205, views: '5.2k', img: 'https://image.pollinations.ai/prompt/cyberpunk%20city%20night%20rain%20neon?nologo=true', prompt: 'Cyberpunk city night rain neon' },
  { id: 2, author: 'AnnaArtist', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anna', likes: 850, views: '3.1k', img: 'https://image.pollinations.ai/prompt/fantasy%20elven%20forest%20magical%20glowing%20mushrooms?nologo=true', prompt: 'Fantasy elven forest magical' },
  { id: 3, author: 'Dmitry_AI', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', likes: 2300, views: '10k', img: 'https://image.pollinations.ai/prompt/portrait%20of%20a%20space%20explorer%20retro%20style?nologo=true', prompt: 'Portrait of a space explorer' },
  { id: 4, author: 'ElenaDesign', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena', likes: 560, views: '1.8k', img: 'https://image.pollinations.ai/prompt/minimalist%20vector%20logo%20fox?nologo=true', prompt: 'Minimalist vector logo fox' },
];

const TOP_AUTHORS = [
  { id: 1, name: 'MasterPrompt', uses: '1.2M', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=King', badge: 'Legend' },
  { id: 2, name: 'NeonDreamer', uses: '850k', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Queen', badge: 'Pro' },
  { id: 3, name: 'VectorGod', uses: '620k', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack', badge: 'Expert' },
  { id: 4, name: 'StableQueen', uses: '410k', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ace', badge: 'Rising' },
  { id: 5, name: 'PixelArt', uses: '300k', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pixel', badge: 'New' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const apiKey = ""; 

  useEffect(() => {
    tg.ready();
    tg.expand();
    document.body.style.backgroundColor = '#000000'; 
    const savedHistory = localStorage.getItem('img_gen_history_v2');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    tg.HapticFeedback.impactOccurred('light');
    if (!model.supportedRatios.includes(selectedRatio.id)) {
      const defaultRatioId = model.supportedRatios[0];
      const newRatio = RATIOS.find(r => r.id === defaultRatioId);
      if (newRatio) setSelectedRatio(newRatio);
    }
  };

  const handleMagicEnhance = async () => {
    tg.HapticFeedback.impactOccurred('medium');
    setIsEnhancing(true);
    try {
      const systemInstruction = prompt.trim() 
        ? `Rewrite user input into a lush, detailed visual prompt (max 600 chars). Return ONLY text.`
        : `Generate a creative, trending AI art concept. Return ONLY text.`;
      const userQuery = prompt.trim() || "Random cool concept";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemInstruction }] } })
      });
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      const enhancedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (enhancedText) {
        setPrompt(enhancedText.trim());
        tg.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      tg.HapticFeedback.notificationOccurred('error');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { tg.HapticFeedback.notificationOccurred('error'); return; }
    tg.HapticFeedback.impactOccurred('heavy');
    setIsGenerating(true);
    setGeneratedImage(null);

    let enhancedPrompt = prompt;
    let modelParam = 'flux';

    switch (selectedModel.id) {
      case 'nanobanana': enhancedPrompt += ", nanobanana style, vivid colors, sharp details, 8k"; modelParam = 'turbo'; break;
      case 'seedream': enhancedPrompt += ", seedream style, dreamy, ethereal, soft lighting"; modelParam = 'midjourney'; break;
      case 'qwen': enhancedPrompt += ", qwen edit, precise, high fidelity, neutral lighting"; modelParam = 'flux-realism'; break;
      case 'flux': enhancedPrompt += ", flux 1.1 pro, photorealistic, raw photo, dslr"; modelParam = 'flux'; break;
    }

    const safePrompt = encodeURIComponent(enhancedPrompt);
    const randomSeed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${safePrompt}?width=${selectedRatio.width}&height=${selectedRatio.height}&seed=${randomSeed}&nologo=true&model=${modelParam}`;

    const img = new Image();
    img.src = url;
    img.onload = () => {
      const newImage = { id: Date.now(), url: url, prompt: prompt, model: selectedModel.name, modelType: selectedModel.type, ratio: selectedRatio.label, date: new Date().toLocaleDateString() };
      setGeneratedImage(newImage);
      const newHistory = [newImage, ...history];
      setHistory(newHistory);
      localStorage.setItem('img_gen_history_v2', JSON.stringify(newHistory));
      setIsGenerating(false);
      tg.HapticFeedback.notificationOccurred('success');
    };
    img.onerror = () => {
      setIsGenerating(false);
      tg.HapticFeedback.notificationOccurred('error');
      alert('Ошибка сети.');
    };
  };

  const clearHistory = () => {
    if(confirm('Очистить историю?')) {
      setHistory([]);
      localStorage.removeItem('img_gen_history_v2');
      tg.HapticFeedback.impactOccurred('medium');
    }
  };

  // --- КОМПОНЕНТЫ ЭКРАНОВ ---

  const FeedScreen = () => (
    <div className="space-y-4 animate-in fade-in duration-500 pb-32">
      <div className="flex items-center justify-between mb-4 px-1 h-10">
        {!isSearchOpen ? (
            <>
                <h2 className="text-2xl font-bold text-white tracking-tight">Популярное</h2>
                <button 
                  onClick={() => { setIsSearchOpen(true); tg.HapticFeedback.impactOccurred('light'); }}
                  className="flex items-center justify-center w-10 h-10 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-95"
                >
                    <Search size={18} />
                </button>
            </>
        ) : (
            <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300 w-full">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Найти промпт..."
                        className="w-full bg-zinc-900 border border-violet-500/50 rounded-full py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all placeholder:text-zinc-600"
                    />
                </div>
                <button 
                   onClick={() => { setIsSearchOpen(false); setSearchQuery(''); tg.HapticFeedback.impactOccurred('light'); }} 
                   className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/5"
                >
                    <X size={20} />
                </button>
            </div>
        )}
      </div>
      
      <div className="columns-2 gap-3 space-y-3">
        {MOCK_FEED.filter(i => i.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || i.author.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
          <div key={item.id} className="break-inside-avoid bg-zinc-900/50 rounded-2xl overflow-hidden border border-white/5 shadow-lg hover:border-white/10 transition-all">
            <img src={item.img} alt="Feed" className="w-full h-auto object-cover" loading="lazy" />
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <img src={item.avatar} className="w-5 h-5 rounded-full ring-1 ring-white/10" alt="ava" />
                <span className="text-[11px] font-medium text-zinc-300 truncate">{item.author}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-zinc-500 font-medium">
                <div className="flex items-center gap-1"><Heart size={10} className="text-rose-500" /> {item.likes}</div>
                <div className="flex items-center gap-1"><Eye size={10} /> {item.views}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {MOCK_FEED.filter(i => i.prompt.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
          <div className="text-center py-10 text-zinc-500">Ничего не найдено</div>
      )}

      {!searchQuery && (
        <button className="w-full py-3 mt-4 text-xs font-bold text-zinc-400 bg-zinc-900/50 border border-white/5 rounded-xl hover:bg-zinc-800 transition-colors active:scale-95">
            Загрузить еще
        </button>
      )}
    </div>
  );

  const TopAuthorsScreen = () => (
    <div className="space-y-4 animate-in fade-in duration-500 pb-32">
      <h2 className="text-2xl font-bold text-white px-1 mb-4 tracking-tight">Топ авторов</h2>
      <div className="space-y-3">
        {TOP_AUTHORS.map((author, index) => (
          <div key={author.id} className="flex items-center gap-4 p-3 bg-zinc-900/40 rounded-2xl border border-white/5 hover:bg-zinc-900/80 transition-colors">
            <div className="font-bold text-lg text-zinc-600 w-6 text-center font-mono">#{index + 1}</div>
            <div className="relative">
              <img src={author.avatar} alt={author.name} className="w-12 h-12 rounded-full border-2 border-zinc-800" />
              {index === 0 && <Crown size={16} className="absolute -top-2 -right-1 text-yellow-400 fill-yellow-400 drop-shadow-md" />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-white">{author.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  author.badge === 'Legend' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                  author.badge === 'Pro' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                  'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>{author.badge}</span>
                <span className="text-[10px] text-zinc-500">Использований: {author.uses}</span>
              </div>
            </div>
            <button className="p-2 bg-white/5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10">
               <Copy size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const ProfileScreen = () => (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
      {/* Profile Header */}
      <div className="bg-gradient-to-b from-zinc-900 to-black p-5 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5 text-violet-500"><Sparkles size={140} /></div>
         
         <div className="flex items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 p-0.5 flex-shrink-0 shadow-lg shadow-violet-900/20">
               <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden relative">
                  <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
               </div>
            </div>
            <div className="flex-1">
               <div className="flex justify-between items-start">
                 <div>
                   <h2 className="text-2xl font-bold text-white leading-none tracking-tight">Felix AI</h2>
                   <p className="text-xs text-zinc-400 mt-1 font-medium">@felix_creator • <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 font-bold">PRO</span></p>
                 </div>
               </div>
               
               <div className="flex gap-2 mt-4">
                 <button className="flex-1 bg-white text-black hover:bg-zinc-200 text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-white/5 active:scale-95">
                    <Edit size={12} /> Редактировать
                 </button>
                 <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-white/5 active:scale-95">
                    <Share2 size={12} /> Поделиться
                 </button>
               </div>
            </div>
         </div>
         
         {/* Stats */}
         <div className="grid grid-cols-3 gap-2 mt-8 border-t border-white/5 pt-5 relative z-10">
            <div className="text-center">
               <div className="text-lg font-bold text-white">{history.length}</div>
               <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Генераций</div>
            </div>
            <div className="text-center border-l border-white/5">
               <div className="text-lg font-bold text-white">842</div>
               <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Подписчики</div>
            </div>
            <div className="text-center border-l border-white/5">
               <div className="text-lg font-bold text-white">1.2k</div>
               <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Лайки</div>
            </div>
         </div>
      </div>

      {/* History Section */}
      <div>
        <div className="flex justify-between items-end mb-4 px-1">
          <h3 className="text-lg font-bold text-white tracking-tight">Мои генерации</h3>
          {history.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-rose-400 flex items-center gap-1 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 size={12} /> Очистить
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
             <History size={32} className="mb-3 opacity-20" />
             <p className="text-sm font-medium">История пуста</p>
             <button onClick={() => setActiveTab('generate')} className="mt-2 text-xs text-violet-400 hover:text-violet-300 font-bold">Создать шедевр</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {history.map((item) => (
              <div key={item.id} className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
                <img src={item.url} alt="History" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-[10px] text-zinc-300 truncate font-medium">{item.prompt}</p>
                </div>
                <button className="absolute top-2 right-2 w-7 h-7 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100">
                   <Download size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // --- ГЛАВНЫЙ РЕНДЕР ---

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 font-sans selection:bg-violet-500/30">
      {/* Ambient Light */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 max-w-lg mx-auto w-full bg-[#000000]/80 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Atom size={20} className="text-black animate-spin-slow" style={{ animationDuration: '8s' }} />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">Ai Verse <span className="text-zinc-500">App</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
              onClick={() => tg.HapticFeedback.impactOccurred('light')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
                <Settings size={18} />
            </button>

            <button onClick={() => setActiveTab('profile')} className="relative group">
                <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-violet-500 to-fuchsia-500">
                    <img 
                        src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" 
                        alt="User" 
                        className="w-full h-full rounded-full border-2 border-black object-cover bg-zinc-800" 
                    />
                </div>
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 p-5 max-w-lg mx-auto">
        {activeTab === 'home' && <FeedScreen />}
        {activeTab === 'top' && <TopAuthorsScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
        
        {activeTab === 'generate' && (
          <div className="space-y-8 animate-in fade-in duration-500 pb-32">
            {/* Prompt Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-end px-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Промпт</label>
                <button onClick={handleMagicEnhance} disabled={isEnhancing || isGenerating} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/40 transition-all">
                  {isEnhancing ? <Loader2 size={12} className="animate-spin text-violet-400" /> : <Wand2 size={12} className="text-violet-400 group-hover:rotate-12 transition-transform" />}
                  <span className="text-[11px] font-bold text-violet-300 group-hover:text-violet-200">{prompt ? "AI Улучшение" : "Мне повезёт"}</span>
                </button>
              </div>
              <div className="relative group">
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl opacity-0 group-focus-within:opacity-40 transition duration-500 blur opacity-20"></div>
                 <textarea 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  placeholder="Опишите вашу идею..." 
                  className="relative w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:bg-zinc-900 transition-all min-h-[120px] resize-none shadow-inner" 
                 />
                 {prompt && <button onClick={() => setPrompt('')} className="absolute top-3 right-3 p-1.5 bg-zinc-800/50 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"><Trash2 size={14} /></button>}
              </div>
            </div>

            {/* Models Grid */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">Модель</label>
              <div className="grid grid-cols-2 gap-3">
                {MODELS.map((model) => (
                  <button key={model.id} onClick={() => handleModelSelect(model)} className={`group relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center gap-3 overflow-hidden ${selectedModel.id === model.id ? 'bg-zinc-900 border-transparent ring-1 ring-white/20 shadow-2xl' : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'}`}>
                    {selectedModel.id === model.id && <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${model.color}`}></div>}
                    
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedModel.id === model.id ? `bg-gradient-to-br ${model.color} text-white scale-110 shadow-lg` : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'}`}>
                      {model.icon}
                    </div>
                    <div className="relative z-10">
                      <span className={`block font-bold text-sm ${selectedModel.id === model.id ? 'text-white' : 'text-zinc-400'}`}>{model.name}</span>
                      <span className="text-[10px] text-zinc-600">{model.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ratios */}
            <div className="space-y-3">
               <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {RATIOS.filter(r => selectedModel.supportedRatios.includes(r.id)).map((ratio) => (
                  <button key={ratio.id} onClick={() => setSelectedRatio(ratio)} className={`flex-shrink-0 w-16 h-12 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${selectedRatio.id === ratio.id ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:bg-zinc-800 hover:border-white/10'}`}>
                    <span className={selectedRatio.id === ratio.id ? 'opacity-100' : 'opacity-60'}>{ratio.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="sticky bottom-28 pt-2 z-30">
               {/* Reduced glow: opacity-50 -> opacity-30, blur-lg -> blur-md, hover opacity-70 -> opacity-50 */}
               <div className={`absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl opacity-30 blur-md transition-opacity duration-500 ${isGenerating ? 'opacity-10' : 'opacity-40 group-hover:opacity-60'}`}></div>
               
               <button 
                onClick={handleGenerate} 
                disabled={isGenerating || !prompt.trim()} 
                className={`relative w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] ${isGenerating ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800' : 'bg-white text-black hover:bg-zinc-100'}`}
               >
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-violet-600 fill-violet-600" />}
                <span>{isGenerating ? "Создание..." : "Сгенерировать"}</span>
               </button>
            </div>

            {/* Result */}
            {generatedImage && (
              <div className="animate-in slide-in-from-bottom-10 fade-in duration-500 pt-2">
                <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                  <div className="relative">
                    <img src={generatedImage.url} alt="Gen" className="w-full h-auto" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-50"></div>
                  </div>
                  <div className="p-4 flex gap-3 bg-black">
                    <button className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors"><Download size={16} /> Сохранить</button>
                    <button className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-violet-900/20"><Share2 size={16} /> Поделиться</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation - LIQUID GLASS */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] z-50 ring-1 ring-white/5">
        {[
          { id: 'home', icon: <Home size={20} />, label: 'Главная' },
          { id: 'top', icon: <Trophy size={20} />, label: 'Топ' },
          { id: 'generate', icon: <Settings2 size={20} />, label: 'Студия' },
          { id: 'profile', icon: <User size={20} />, label: 'Профиль' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); tg.HapticFeedback.impactOccurred('light'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-300 ${
              activeTab === tab.id ? 'bg-white/10 text-white shadow-inner backdrop-blur-md scale-100 border border-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <div className={`${activeTab === tab.id ? 'scale-100 text-white' : 'scale-90'} transition-transform`}>{tab.icon}</div>
            {activeTab === tab.id && <span className="text-[10px] font-bold tracking-wide animate-in slide-in-from-left-2 fade-in duration-200 hidden sm:inline-block">{tab.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}