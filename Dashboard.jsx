import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Brain, FileText, Wand2, Layers, Mic, LayoutGrid, Clock, User,
  Sparkles, ArrowRight, SquarePen, Link as LinkIcon, Plus, Briefcase,
  GraduationCap, Stethoscope, Scale, Landmark, Code, Activity,
  CheckCircle2, Paperclip, ChevronUp, Loader2, X, Trash2, Image as ImageIcon, Search,
  Globe, MessageSquare, FolderOpen, ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import shinchanImg from '../assets/shinchan.png';
import shinchan2Img from "../assets/shinchan2.png";

const DB_NAME = 'truthlens_local_db';
const DB_VERSION = 1;
const CHAT_STORE = 'chats';
const LIBRARY_STORE = 'library';

function openTruthLensDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not supported in this browser.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAT_STORE)) db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openTruthLensDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function dbPut(storeName, value) {
  const db = await openTruthLensDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbDelete(storeName, id) {
  const db = await openTruthLensDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function makeTitle(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New investigation';
  return clean.length > 34 ? `${clean.slice(0, 34).trim()}…` : clean;
}

function fileKind(file) {
  if (file.type?.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
}

export default function Dashboard() {
  const [selectedAI, setSelectedAI] = useState('auto');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [activeDomain, setActiveDomain] = useState('Study');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timer, setTimer] = useState(0);
  const [savedLibrary, setSavedLibrary] = useState([]);
  const [savedHistory, setSavedHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [libraryTab, setLibraryTab] = useState('image');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [attachedLinks, setAttachedLinks] = useState([]);
  const [liveSteps, setLiveSteps] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const stepTracker = useRef({});
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const requestController = useRef(null);
  const requestIdRef = useRef(0);

  const domains = [
    { name: 'Study', icon: GraduationCap, color: 'text-blue-500' },
    { name: 'Medical', icon: Stethoscope, color: 'text-emerald-500' },
    { name: 'Legal', icon: Scale, color: 'text-red-500' },
    { name: 'Government', icon: Landmark, color: 'text-amber-500' },
    { name: 'Finance', icon: Briefcase, color: 'text-purple-500' },
    { name: 'Tech', icon: Code, color: 'text-sky-500' },
    { name: 'Research', icon: Search, color: 'text-cyan-500' }
  ];

  const persistChat = useCallback(async (chat) => {
    if (!chat?.id) return;
    try {
      await dbPut(CHAT_STORE, chat);
      setSavedHistory((prev) => {
        const next = [chat, ...prev.filter((item) => item.id !== chat.id)].sort((a, b) => b.updatedAt - a.updatedAt);
        return next;
      });
    } catch (error) { console.error('Could not save chat to IndexedDB:', error); }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [chats, library] = await Promise.all([dbGetAll(CHAT_STORE), dbGetAll(LIBRARY_STORE)]);
        if (!mounted) return;
        const sorted = chats.sort((a, b) => b.updatedAt - a.updatedAt);
        setSavedHistory(sorted);
        setSavedLibrary(library.sort((a, b) => b.createdAt - a.createdAt));
      } catch (error) { console.error('IndexedDB initialisation failed:', error); }
      finally { if (mounted) setDbReady(true); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (isAnalyzing) {
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((value) => +(value + 0.1).toFixed(1)), 100);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [isAnalyzing]);

  useEffect(() => {
    if (!dbReady || !activeChatId || messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === 'user');
    const existing = savedHistory.find((item) => item.id === activeChatId);
    const chat = {
      id: activeChatId,
      title: existing?.title || makeTitle(firstUser?.content),
      date: new Date().toLocaleDateString(),
      updatedAt: Date.now(),
      domain: activeDomain,
      messages
    };
    const timeout = setTimeout(() => persistChat(chat), 250);
    return () => clearTimeout(timeout);
  }, [messages, activeChatId, activeDomain, dbReady]);

  const handleInputChange = (event) => {
    setInput(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const handleAddLink = () => {
    const value = urlInput.trim();
    if (!value) return;
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP/HTTPS links are supported.');
      setAttachedLinks((prev) => [...prev, parsed.href]);
      setUrlInput('');
      setShowLinkDialog(false);
    } catch { alert('Please enter a valid URL starting with https:// or http://'); }
  };

  const saveLibraryItems = async (files, links) => {
    const records = [
      ...files.map((file) => ({
        id: `file-${crypto.randomUUID()}`, type: fileKind(file), name: file.name,
        mime: file.type, size: file.size, blob: file, createdAt: Date.now(), date: new Date().toLocaleString()
      })),
      ...links.map((url) => ({ id: `url-${crypto.randomUUID()}`, type: 'url', name: url, url, createdAt: Date.now(), date: new Date().toLocaleString() }))
    ];
    for (const record of records) await dbPut(LIBRARY_STORE, record);
    if (records.length) setSavedLibrary((prev) => [...records, ...prev]);
  };

  const parseSSEBlock = (block) => {
    if (!block.trim()) return;
    const eventMatch = block.match(/^event:\s*(.+)$/m);
    const dataMatch = block.match(/^data:\s*(.+)$/m);
    if (!eventMatch || !dataMatch) return;
    let data;
    try { data = JSON.parse(dataMatch[1].trim()); } catch { return; }
    const eventType = eventMatch[1].trim();
    const now = Date.now();
    if (eventType === 'progress') {
      const stepIndex = Number(data.step);
      const elapsed = ((now - (stepTracker.current.lastEvent || now)) / 1000).toFixed(1) + 's';
      stepTracker.current.lastEvent = now;
      setLiveSteps((prev) => prev.map((step, index) => {
        if (index < stepIndex - 1 && step.status !== 'completed') return { ...step, status: 'completed', time: elapsed };
        if (index === stepIndex - 1) return { ...step, status: 'active', label: data.message || step.label };
        return step;
      }));
    } else if (eventType === 'token') {
      setMessages((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === 'assistant') next[last] = { ...next[last], isThinking: false, content: (next[last].content || '') + (data.text || '') };
        return next;
      });
    } else if (eventType === 'complete') {
      setLiveSteps((prev) => prev.map((step) => step.status === 'active' ? { ...step, status: 'completed', time: ((now - (stepTracker.current.lastEvent || now)) / 1000).toFixed(1) + 's' } : step));
    } else if (eventType === 'error') {
      throw new Error(data.message || 'The AI service returned an error.');
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0 && attachedLinks.length === 0) || isAnalyzing) return;

    const userText = input.trim();
    const files = [...attachedFiles];
    const links = [...attachedLinks];
    const requestId = ++requestIdRef.current;

    requestController.current?.abort();
    requestController.current = new AbortController();

    const chatId = activeChatId || crypto.randomUUID();

    const userMessage = {
      role: 'user',
      content: userText,
      files: files.map((file) => file.name),
      links,
      createdAt: Date.now()
    };

    const assistantMessage = {
      role: 'assistant',
      content: '',
      isThinking: true,
      createdAt: Date.now()
    };

    const nextMessages = [...messages, userMessage, assistantMessage];

    setActiveChatId(chatId);
    setMessages(nextMessages);
    setInput('');
    setAttachedFiles([]);
    setAttachedLinks([]);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsAnalyzing(true);
    stepTracker.current = { lastEvent: Date.now() };

    setLiveSteps([
      { id: 1, label: 'Understanding your question...', status: 'active', time: '' },
      { id: 2, label: 'Reading attachments and collecting evidence...', status: 'idle', time: '' },
      { id: 3, label: 'Analysing information and checking evidence...', status: 'idle', time: '' },
      { id: 4, label: 'Generating your response...', status: 'idle', time: '' }
    ]);

    try {
      await saveLibraryItems(files, links);

      
      const formData = new FormData();
      formData.append('text', userText);
      formData.append('domain', activeDomain.toLowerCase());
      formData.append('urls', JSON.stringify(links));

      files.forEach((file) => {
        formData.append('files', file, file.name);
      });

      const response = await fetch('http://localhost:8000/api/investigate', {
        signal: requestController.current.signal,
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let detail = '';
        try {
          const errorData = await response.json();
          detail = errorData.detail || errorData.message || '';
        } catch {
          // The server may return a non-JSON error response.
        }

        throw new Error(
          detail || `Server returned ${response.status}. Check that the backend is running.`
        );
      }

      if (!response.body) {
        throw new Error('Streaming response is not available in this browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processBlock = (block) => {
        if (!block.trim()) return;
        parseSSEBlock(block);
      };

      const processBuffer = (final = false) => {
      
        const normalised = buffer.replace(/\r\n/g, '\n');
        const blocks = normalised.split('\n\n');

        if (final) {
          buffer = '';
          blocks.filter(Boolean).forEach(processBlock);
        } else {
          buffer = blocks.pop() || '';
          blocks.filter(Boolean).forEach(processBlock);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        processBuffer(false);
      }

      buffer += decoder.decode();
      processBuffer(true);

    
      setMessages((prev) => prev.map((message, index) =>
        index === prev.length - 1
          ? { ...message, isThinking: false }
          : message
      ));

    } catch (error) {
      if (error.name === 'AbortError' || requestId !== requestIdRef.current) return;

      console.error('TRUSTLENS request failed:', error);

      setMessages((prev) => prev.map((message, index) =>
        index === prev.length - 1
          ? {
              ...message,
              isThinking: false,
              content: message.content || `**System notice:** ${error.message || 'Connection failed. Please try again.'}`
            }
          : message
      ));

      setLiveSteps((prev) => prev.map((step) => ({
        ...step,
        status: step.status === 'active' ? 'completed' : step.status
      })));

    } finally {
      if (requestId === requestIdRef.current) {
        setIsAnalyzing(false);
        requestController.current = null;
        
      }
    }
  };

  const startNewInvestigation = async () => {
    requestIdRef.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    setIsAnalyzing(false);
    if (messages.length && activeChatId) {
      const firstUser = messages.find((message) => message.role === 'user');
      await persistChat({ id: activeChatId, title: makeTitle(firstUser?.content), date: new Date().toLocaleDateString(), updatedAt: Date.now(), domain: activeDomain, messages });
    }
    setActiveChatId(null); setMessages([]); setInput(''); setAttachedFiles([]); setAttachedLinks([]); setLiveSteps([]); setActiveModal(null);
  };

  const openSavedChat = (chat) => {
    setActiveChatId(chat.id); setMessages(chat.messages || []); setActiveDomain(chat.domain || 'Study'); setLiveSteps([]); setActiveModal(null);
  };

  const deleteChat = async (event, chatId) => {
    event.stopPropagation();
    await dbDelete(CHAT_STORE, chatId);
    setSavedHistory((prev) => prev.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) { setActiveChatId(null); setMessages([]); setLiveSteps([]); }
  };

  const deleteLibraryItem = async (id) => {
    await dbDelete(LIBRARY_STORE, id);
    setSavedLibrary((prev) => prev.filter((item) => item.id !== id));
  };

  const renderLibrary = () => {
    const items = savedLibrary.filter((item) => item.type === libraryTab);
    return <>
      <div className="library-tabs">
        <button className={libraryTab === 'image' ? 'selected' : ''} onClick={() => setLibraryTab('image')}><ImageIcon /> Images</button>
        <button className={libraryTab === 'pdf' ? 'selected' : ''} onClick={() => setLibraryTab('pdf')}><FileText /> PDFs</button>
        <button className={libraryTab === 'url' ? 'selected' : ''} onClick={() => setLibraryTab('url')}><Globe /> URLs</button>
      </div>
      <div className="library-grid">
        {items.length === 0 ? <div className="library-empty">No {libraryTab === 'url' ? 'links' : libraryTab === 'pdf' ? 'PDF files' : 'images'} saved yet.</div> : items.map((item) => (
          <article className="library-card" key={item.id}>
            {item.type === 'image' ? <img className="library-thumb" src={URL.createObjectURL(item.blob)} alt={item.name} /> : <div className="library-file-icon">{item.type === 'pdf' ? <FileText /> : <Globe />}</div>}
            <div className="library-card-meta"><strong title={item.name}>{item.name}</strong><small>{item.date}</small></div>
            {item.type === 'url' && <a href={item.url} target="_blank" rel="noreferrer" className="library-open"><ExternalLink size={15} /></a>}
            {item.type === 'pdf' && item.blob && <a href={URL.createObjectURL(item.blob)} target="_blank" rel="noreferrer" className="library-open"><ExternalLink size={15} /></a>}
            <button className="library-delete" onClick={() => deleteLibraryItem(item.id)} aria-label="Delete library item"><Trash2 size={15} /></button>
          </article>
        ))}
      </div>
    </>;
  };

  const renderModal = () => {
    if (!activeModal) return null;
    return <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
      <section className="dashboard-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setActiveModal(null)}><X /></button>
        {activeModal === 'library' ? <><h2><FolderOpen /> Your Library</h2>{renderLibrary()}</> : null}
        {activeModal === 'history' ? <><h2><Clock /> Investigation History</h2><div className="history-modal-list">{savedHistory.length === 0 ? <p className="library-empty">Your investigations will appear here automatically.</p> : savedHistory.map((chat) => <button className="history-modal-item" key={chat.id} onClick={() => openSavedChat(chat)}><span><strong>{chat.title}</strong><small>{chat.date} · {chat.domain || 'General'}</small></span><span className="history-actions"><ArrowRight /><span onClick={(event) => deleteChat(event, chat.id)}><Trash2 /></span></span></button>)}</div></> : null}
        {['smart', 'models', 'voice'].includes(activeModal) ? <div className="coming-soon"><h2>Coming Soon</h2><p>This module is currently in development for the next update.</p></div> : null}
      </section>
    </div>;
  };

  return <div className={`dashboard-root ${messages.length === 0 ? "is-idle" : "has-messages"}`}>
    <div className="bg-linear-grid" />
    <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /><div className="orb orb-4" />
    <div className="orb orb-5" /><div className="orb orb-6" /><div className="orb orb-7" /><div className="orb orb-8" /><div className="orb orb-9" />
    <div className="outer-glass-frame">
      {renderModal()}
      <header className="top-actions">
        <button className="new-investigation" onClick={startNewInvestigation}><SquarePen size={17} /> New Investigation</button>
        <button className="profile-button" aria-label="Profile"><User size={19} /></button>
      </header>

      <aside className="left-sidebar">
        <div className="brand-row"><div className="brand-icon"><Brain /></div><div><h1>TruthLens <span>AI</span></h1><small>AI PLATFORM</small></div></div>
        <div className="sidebar-heading"><span>FEATURES & TOOLS</span><LayoutGrid size={16} /></div>
        <nav className="feature-nav">
          <button onClick={() => setActiveModal('library')}><FileText className="blue" /><span>Library</span></button>
          <button onClick={() => setActiveModal('smart')}><Wand2 className="purple" /><span>Smart Tools</span></button>
          <button onClick={() => setActiveModal('models')}><Layers className="orange" /><span>Project Models</span></button>
          <button onClick={() => setActiveModal('voice')}><Mic className="green" /><span>Voice Notes</span></button>
        </nav>
        <div className="sidebar-heading recent-heading"><span>RECENT INVESTIGATIONS</span></div>
        <div className="recent-list">
          {savedHistory.map((chat) => <div className={`recent-chat ${activeChatId === chat.id ? 'current' : ''}`} key={chat.id}>
            <button className="recent-open" onClick={() => openSavedChat(chat)}><MessageSquare size={17} /><span>{chat.title}</span></button>
            <button className="recent-delete" onClick={(event) => deleteChat(event, chat.id)} title="Delete investigation"><Trash2 size={15} /></button>
          </div>)}
        </div>
      </aside>

      <main className="main-workspace">
        {messages.length === 0 ? <section className="welcome-content">
          <div className="welcome-shinchan-wrap">
  <img
    src={shinchan2Img}
    alt="Sleeping Shinchan"
    className="welcome-shinchan"
  />
</div>
          <h2>How can I help you <span>investigate?</span></h2>
          <p className="welcome-subtitle">Ask, verify, analyze, and get evidence-backed insights with <strong>TruthLens AI Evidence.</strong></p>
          <div className="domain-grid">
            {domains.map(({ name, icon: Icon, color }) => <button key={name} onClick={() => setActiveDomain(name)} className={`domain-pill ${activeDomain === name ? 'active' : ''}`}><Icon className={color} size={17} />{name}</button>)}
          </div>
        </section> : <section className="chat-messages">
          {messages.map((message, index) => <div className={`message-row ${message.role}`} key={`${message.createdAt || index}-${index}`}>
            {message.role === 'assistant' && <div className="assistant-avatar"><Brain size={17} /></div>}
            <div className="message-content">
              {message.isThinking ? <div className="thinking"><Loader2 className="spin" size={18} /> Thinking… {timer.toFixed(1)}s</div> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>}
              {message.files?.length > 0 && <div className="message-attachments">{message.files.map((name) => <span key={name}><Paperclip size={13} />{name}</span>)}</div>}
              {message.links?.length > 0 && <div className="message-attachments">{message.links.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><LinkIcon size={13} />{url}</a>)}</div>}
            </div>
          </div>)}
          <div ref={messagesEndRef} />
        </section>}

        <div className="composer-wrap">
          {showLinkDialog && <div className="url-dialog"><LinkIcon size={17} /><input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleAddLink()} placeholder="Paste URL link here…" /><button onClick={handleAddLink}>Add</button><button className="dialog-close" onClick={() => setShowLinkDialog(false)}><X size={16} /></button></div>}
          {(attachedFiles.length > 0 || attachedLinks.length > 0) && <div className="attachment-chips">
            {attachedFiles.map((file, index) => <span key={`${file.name}-${index}`}><Paperclip size={13} />{file.name}<button onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== index))}>×</button></span>)}
            {attachedLinks.map((link, index) => <span key={`${link}-${index}`}><LinkIcon size={13} />{link}<button onClick={() => setAttachedLinks((prev) => prev.filter((_, i) => i !== index))}>×</button></span>)}
          </div>}
          <div className="composer-toolbar">
            {messages.length > 0 && <select className="domain-select" value={activeDomain} onChange={(event) => setActiveDomain(event.target.value)}>{domains.map((domain) => <option key={domain.name}>{domain.name}</option>)}</select>}
          </div>
          <div className="search-static-border"><div className="search-inner">
            <div className="search-input-row"><Sparkles size={20} className="search-sparkle" /><textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend(); } }} rows={1} placeholder="Ask TruthLens AI anything…" /></div>
            <div className="search-actions"><div className="search-tools"><button onClick={() => fileInputRef.current?.click()} title="Attach image or PDF"><Plus size={21} /></button><input ref={fileInputRef} type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" onChange={handleFileSelect} /><button onClick={() => setShowLinkDialog((value) => !value)} title="Add URL"><LinkIcon size={20} /></button><div className="inline-model-wrap"><button className="model-selector inline-model-selector" onClick={() => setShowModelDropdown((value) => !value)}><span className="ai-model-icon"><Sparkles size={14} /></span><span>Auto AI</span><ChevronUp size={13} className={showModelDropdown ? 'rotate' : ''} /></button>{showModelDropdown && <div className="model-menu inline-model-menu">
                <button className="model-option-selected" onClick={() => { setSelectedAI('auto'); setShowModelDropdown(false); }}><Sparkles size={14} /> Auto AI <small>Groq-powered</small></button>
                <button className="model-option-disabled" disabled><span className="model-provider-dot" /> Gemini <small>Coming soon</small></button>
                <button className="model-option-disabled" disabled><span className="model-provider-dot" /> Additional model <small>Coming soon</small></button>
              </div>}</div></div><button className="send-button" onClick={handleSend} disabled={isAnalyzing || (!input.trim() && !attachedFiles.length && !attachedLinks.length)}><ArrowRight size={21} /></button></div>
          </div></div>
        </div>
      </main>

      <aside className="audit-sidebar">
  <div className="audit-shinchan-wrap">
    <img
      src={shinchanImg}
      alt="Sleeping Shinchan"
      className="audit-shinchan"
    />
  </div>
        <section className="audit-card">
          <div className="red-corner-br" />
          <div className="audit-tab">★</div>
          <div className="audit-heading"><Activity size={23} /><div><h3>Live Audit Stream</h3><p>Real-time verification & analysis</p></div></div>
          <div className="audit-content">
            {liveSteps.length === 0 ? <p className="audit-empty">Awaiting query… Initiate investigation to trigger real-time audit steps.</p> : <div className="audit-steps">{liveSteps.map((step, index) => <div className="audit-step" key={step.id}><span className={`step-dot ${step.status}`}>{step.status === 'completed' ? <CheckCircle2 size={18} /> : null}</span><span className="step-label">{step.label}</span>{step.time && <small>{step.time}</small>}</div>)}</div>}
          </div>
        </section>
      </aside>
    </div>
  </div>;
}
