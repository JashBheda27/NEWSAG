import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatService, type ChatMessage, type ChatContext } from '../../services/chat.service';

interface ChatBotProps {
  articleContext?: ChatContext;
  onError?: (message: string) => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ articleContext: initialContext, onError }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [articleContext, setArticleContext] = useState<ChatContext | undefined>(initialContext);
  const [currentArticleTitle, setCurrentArticleTitle] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Listen for global open chatbot events
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent<{ articleId: string; articleTitle: string }>) => {
      const { articleId, articleTitle } = event.detail;
      setArticleContext({ article_id: articleId });
      setCurrentArticleTitle(articleTitle);
      setIsOpen(true);
      setInput(`Tell me about this article: "${articleTitle.substring(0, 50)}..."`);
    };

    window.addEventListener('openChatBot', handleOpenChat as EventListener);
    return () => {
      window.removeEventListener('openChatBot', handleOpenChat as EventListener);
    };
  }, []);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const isNearBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return false;
    const { scrollHeight, scrollTop, clientHeight } = el;
    return scrollHeight - (scrollTop + clientHeight) <= 100;
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [messages, isNearBottom, scrollToBottom]);

  // Load chat history when opening
  useEffect(() => {
    if (isOpen && !hasLoadedHistory) {
      loadHistory();
    }
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen, hasLoadedHistory]);

  // Handle article context changes
  useEffect(() => {
    if (articleContext?.article_id && isOpen) {
      // Auto-prompt for article context
      setInput(`Tell me about this article`);
    }
  }, [articleContext, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, scrollToBottom]);

  const loadHistory = async () => {
    try {
      const response = await chatService.getHistory(20);
      if (response.messages.length > 0) {
        setMessages(response.messages);
      } else {
        // Add welcome message
        setMessages([{
          role: 'assistant',
          content: `👋 **Hi! I'm your NewsAura AI assistant.**\n\nI can help you with:\n• Summarizing your saved articles\n• Giving you a daily briefing\n• Analyzing your reading patterns\n• Recommending what to read next\n\nTry asking: "What should I read first?"`,
        }]);
      }
      setHasLoadedHistory(true);
    } catch {
      // Silently fail and show welcome message
      setMessages([{
        role: 'assistant',
        content: `👋 **Hello! I'm your NewsAura AI assistant.**\n\nHow can I help you today?`,
      }]);
      setHasLoadedHistory(true);
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedInput,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(trimmedInput, articleContext);
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        intent: response.intent,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'AI assistant temporarily unavailable';
      onError?.(errMsg);
      // Add error message with friendly fallback
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "⚠️ **AI assistant is temporarily unavailable.**\n\nThis can happen if the AI service is starting up or is under heavy load. Please try again in a moment.\n\n_Tip: Basic features like bookmarking and read-later still work normally._",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: '📰 Daily Briefing', action: "Give me today's briefing" },
    { label: '📚 Summarize Saved', action: 'Summarize my saved articles' },
    { label: '📊 Reading Patterns', action: 'What topics do I read the most?' },
    { label: '📖 What to Read', action: 'What should I read first?' },
  ];

  const handleQuickAction = (action: string) => {
    setInput(action);
    // Auto-send
    setTimeout(() => {
      const btn = document.getElementById('chatbot-send-btn');
      btn?.click();
    }, 100);
  };

  // Format message content (basic markdown)
  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        aria-label="Ask NewsAura AI"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-2xl transition-shadow z-40 group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, type: "easeInOut" }}
      >
        <div className="relative">
          {/* NA Bot Icon */}
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm1.61-9.96c-2.06-.3-3.88.97-4.43 2.79-.18.58.26 1.17.87 1.17h.2c.41 0 .74-.29.88-.67.32-.89 1.27-1.5 2.3-1.28.95.2 1.65 1.13 1.57 2.1-.1 1.34-1.62 1.63-2.45 2.88 0 .01-.01.01-.01.02-.01.02-.02.03-.03.05-.09.15-.18.32-.25.5-.01.03-.03.05-.04.08-.01.02-.01.04-.02.07-.12.34-.2.75-.2 1.25h2c0-.42.11-.77.28-1.07.02-.03.03-.06.05-.09.08-.14.18-.27.28-.39.01-.01.02-.03.03-.04.1-.12.21-.23.33-.34.96-.91 2.26-1.65 1.99-3.56-.24-1.74-1.61-3.21-3.35-3.47z" />
          </svg>
          {/* Pulse indicator */}
          <motion.span 
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        {/* Tooltip */}
        <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Ask NewsAura AI
        </span>
      </motion.button>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            
            {/* Chat Window */}
            <motion.div 
              className="relative w-full max-w-md h-[600px] max-h-[85vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                    NA
                  </div>
                  <div>
                    <h3 className="font-semibold">NewsAura AI</h3>
                    <p className="text-xs text-indigo-200">Your Personal News Assistant</p>
                  </div>
                </div>
                <motion.button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              {/* Quick Actions */}
              <AnimatePresence>
                {messages.length <= 1 && (
                  <motion.div 
                    className="px-4 py-3 border-b border-slate-200 dark:border-slate-700"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick actions:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((qa, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => handleQuickAction(qa.action)}
                          className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-full transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {qa.label}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Article Context Banner */}
              <AnimatePresence>
                {articleContext && currentArticleTitle && (
                  <motion.div 
                    className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600 dark:text-purple-400">📰</span>
                      <p className="text-xs text-purple-700 dark:text-purple-300 truncate">
                        Asking about: <strong>{currentArticleTitle}</strong>
                      </p>
                      <motion.button
                        onClick={() => { setArticleContext(undefined); setCurrentArticleTitle(''); }}
                        className="ml-auto text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
                        title="Clear article context"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              >
                <AnimatePresence>
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <motion.div
                        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'
                        }`}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div 
                          className="text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                        />
                        {msg.intent && msg.role === 'assistant' && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-600/50">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              {msg.intent.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Loading indicator - AI typing */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div 
                      className="flex justify-start"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="bg-slate-100 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <motion.span 
                              className="w-2 h-2 bg-indigo-500 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                            />
                            <motion.span 
                              className="w-2 h-2 bg-indigo-500 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                            />
                            <motion.span 
                              className="w-2 h-2 bg-indigo-500 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 italic">AI is thinking...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your news..."
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all"
                    disabled={isLoading}
                  />
                  <motion.button
                    id="chatbot-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </motion.button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
                  I only use your saved articles — no external lookups
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;
