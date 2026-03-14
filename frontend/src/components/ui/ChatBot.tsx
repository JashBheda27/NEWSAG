import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { BookCheck, BookText, Bot, ChartColumn, Newspaper, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatService, type ChatMessage, type ChatContext } from '../../services/chat.service';

// Memoized message bubble component to prevent re-renders
const MessageBubble = memo<{ msg: ChatMessage; formatContent: (content: string) => string }>(
  ({ msg, formatContent }) => (
    <div
      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
    >
      <div
        className={`max-w-[85%] px-4 py-3 transform-gpu transition-all duration-200 hover:scale-[1.01] ${
          msg.role === 'user'
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-md shadow-lg shadow-indigo-500/20'
            : 'bg-slate-100/80 dark:bg-slate-700/80 backdrop-blur-sm text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-md border border-slate-200/50 dark:border-slate-600/50'
        }`}
      >
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
        />
        {msg.intent && msg.role === 'assistant' && (
          <div className="mt-2 pt-2 border-t border-slate-200/30 dark:border-slate-600/30">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
              {msg.intent.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
);

MessageBubble.displayName = 'MessageBubble';

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
          content: `**Hi! I'm your NewsAura AI assistant.**\n\nI can help you with:\n• Summarizing your saved articles\n• Giving you a daily briefing\n• Analyzing your reading patterns\n• Recommending what to read next\n\nTry asking: "What should I read first?"`,
        }]);
      }
      setHasLoadedHistory(true);
    } catch {
      // Silently fail and show welcome message
      setMessages([{
        role: 'assistant',
        content: `**Hello! I'm your NewsAura AI assistant.**\n\nHow can I help you today?`,
      }]);
      setHasLoadedHistory(true);
    }
  };

  const handleSend = useCallback(async () => {
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
        content: "**AI assistant is temporarily unavailable.**\n\nThis can happen if the AI service is starting up or is under heavy load. Please try again in a moment.\n\n_Tip: Basic features like bookmarking and read-later still work normally._",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, articleContext, onError]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Memoize quick actions to prevent recreation
  const quickActions = useMemo(() => [
    { label: 'Daily Briefing', icon: Newspaper, action: "Give me today's briefing" },
    { label: 'Summarize Saved', icon: BookText, action: 'Summarize my saved articles' },
    { label: 'Reading Patterns', icon: ChartColumn, action: 'What topics do I read the most?' },
    { label: 'What to Read', icon: BookCheck, action: 'What should I read first?' },
  ], []);

  const handleQuickAction = useCallback((action: string) => {
    setInput(action);
    // Auto-send
    setTimeout(() => {
      const btn = document.getElementById('chatbot-send-btn');
      btn?.click();
    }, 100);
  }, []);

  // Format message content (basic markdown) - memoized
  const formatContent = useCallback((content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  }, []);

  return (
    <>
      <style>{`
        @media (max-width: 1023px) {
          .chatbot-fab {
            bottom: calc(80px + 24px) !important;
          }
        }
        
        @media (min-width: 1024px) {
          .chatbot-fab {
            bottom: 24px !important;
          }
        }
      `}</style>
      {/* Floating Button */}
      <motion.button
        aria-label="Ask NewsAura AI"
        onClick={() => setIsOpen(true)}
        className="chatbot-fab fixed right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-2xl transition-shadow z-40 group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, type: "easeInOut" }}
      >
        <div className="relative">
          <Bot size={28} aria-hidden="true" />
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
              className="relative w-full max-w-md h-[600px] max-h-[85vh] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-t-[2rem] rounded-b-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/50 dark:border-slate-700/50"
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-t-[2rem]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center font-black text-lg shadow-inner">
                    NA
                  </div>
                  <div>
                    <h3 className="font-bold text-base">NewsAura AI</h3>
                    <p className="text-xs text-indigo-200/80">Your Personal News Assistant</p>
                  </div>
                </div>
                <motion.button 
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Close AI chat"
                >
                  <X size={20} aria-hidden="true" />
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
                          <span className="inline-flex items-center gap-1.5">
                            <qa.icon size={14} aria-hidden="true" />
                            {qa.label}
                          </span>
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
                      <Newspaper size={14} className="text-purple-600 dark:text-purple-400" aria-hidden="true" />
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
                        <X size={16} aria-hidden="true" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4 will-change-scroll"
                style={{ scrollBehavior: 'smooth' }}
              >
                {messages.map((msg, idx) => (
                  <MessageBubble 
                    key={`msg-${idx}-${msg.role}`} 
                    msg={msg} 
                    formatContent={formatContent} 
                  />
                ))}
                
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
              <div className="px-4 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your news..."
                    className="flex-1 px-5 py-3 bg-slate-100/80 dark:bg-slate-700/80 backdrop-blur-sm text-slate-800 dark:text-slate-200 rounded-full border-none focus:ring-2 focus:ring-indigo-500/50 focus:outline-none text-sm transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    disabled={isLoading}
                  />
                  <motion.button
                    id="chatbot-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white rounded-full transition-all shadow-lg shadow-indigo-500/30 disabled:shadow-none"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label="Send message"
                  >
                    <Send size={20} aria-hidden="true" />
                  </motion.button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3">
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
