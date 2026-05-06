import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Phone, Mail, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const QUICK_REPLIES = [
  "Book an event",
  "Suggest an event",
  "Contact support"
];

const CONTACT_ACTIONS = [
  { icon: Phone, label: "Call Now", href: "tel:+917981648202", color: "hover:text-blue-400" },
  { icon: MessageCircle, label: "WhatsApp", href: "https://wa.me/917981648202", color: "hover:text-green-400" },
  { icon: Mail, label: "Email", href: "mailto:ashishjanapareddi@gmail.com", color: "hover:text-red-400" }
];

export function ChatWidget({ onOpenBooking }: { onOpenBooking: (type?: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hi! Welcome to Aahwanam 🎉 How can I help you plan your event today?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Intent detection
      const { intent, suggestedType } = await geminiService.detectIntent(text);

      if (intent === 'book_event') {
        setMessages(prev => [...prev, { role: 'model', content: "Initializing booking protocol. Opening the Event Mandate Form now..." }]);
        setTimeout(() => {
          onOpenBooking(suggestedType);
        }, 1000);
      } else if (intent === 'get_recommendation') {
        const response = await geminiService.getAIResponse(text, messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })));
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: response || `Based on your request, I recommend a ${suggestedType} event. It matches your keywords perfectly. Would you like me to open the booking form for this?` 
        }]);
      } else {
        const response = await geminiService.getAIResponse(text, messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })));
        setMessages(prev => [...prev, { role: 'model', content: response || "I'm sorry, I couldn't process that." }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="mb-4 w-full max-w-[380px] h-[550px] bg-editorial-card border border-editorial-border shadow-2xl flex flex-col overflow-hidden rounded-xl"
          >
            {/* Header */}
            <div className="p-5 border-b border-editorial-border bg-editorial-bg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-editorial-accent/10 flex items-center justify-center border border-editorial-accent/20">
                  <div className="w-2 h-2 bg-editorial-accent rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="font-mono text-xs font-black uppercase tracking-[0.2em] text-editorial-text">AAHWANAM_AI</h3>
                  <p className="text-[10px] text-editorial-accent/60 font-medium italic">Online Concierge</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-editorial-text/5 rounded-full transition-colors text-editorial-text/40 hover:text-editorial-accent"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
              {messages.map((msg, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx}
                  className={cn(
                    "max-w-[85%] p-3 rounded-xl text-xs leading-relaxed",
                    msg.role === 'user' 
                      ? "ml-auto bg-editorial-accent text-editorial-bg font-medium" 
                      : "mr-auto bg-editorial-text/5 text-editorial-text/80 border border-editorial-border/50"
                  )}
                >
                  {msg.content}
                </motion.div>
              ))}
              {isTyping && (
                <div className="mr-auto bg-editorial-text/5 p-3 rounded-xl border border-editorial-border/50 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-editorial-accent/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-editorial-accent/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-editorial-accent/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            {/* Quick Replies & Actions */}
            <div className="p-4 border-t border-editorial-border bg-editorial-bg/50 space-y-4">
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => handleSend(reply)}
                    className="px-3 py-1.5 bg-editorial-text/5 border border-editorial-border hover:border-editorial-accent/40 transition-all text-[10px] font-mono font-black tracking-widest text-editorial-text/60 hover:text-editorial-accent rounded-sm uppercase"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-2 border-t border-editorial-border/30">
                {CONTACT_ACTIONS.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex flex-col items-center gap-1.5 group transition-colors",
                      action.color
                    )}
                  >
                    <action.icon size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[8px] font-mono font-black uppercase tracking-[0.1em] opacity-40 group-hover:opacity-100">{action.label}</span>
                  </a>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2 items-center bg-editorial-card border border-editorial-border p-2 rounded-lg">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent border-none text-xs text-editorial-text focus:outline-none placeholder:text-editorial-text/20 font-sans"
                />
                <button
                  onClick={() => handleSend(input)}
                  className="w-8 h-8 bg-editorial-accent text-editorial-bg rounded-md flex items-center justify-center hover:bg-editorial-text transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-editorial-accent text-editorial-bg shadow-2xl rounded-full flex items-center justify-center group relative overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MessageSquare size={24} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
      </motion.button>
    </div>
  );
}
