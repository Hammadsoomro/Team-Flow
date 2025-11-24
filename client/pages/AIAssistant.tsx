import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  MessageSquare,
  Zap,
  Settings,
  User,
  Menu,
  X,
  Mic,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputValue,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Chat History", icon: MessageSquare },
    { label: "Quick Actions", icon: Zap },
    { label: "Settings", icon: Settings },
    { label: "Profile", icon: User },
  ];

  return (
    <div className="ai-assistant min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Background Gradient Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full blur-3xl opacity-20 bg-blue-500"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full blur-3xl opacity-15 bg-cyan-500"></div>
        <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full blur-3xl opacity-10 bg-purple-500"></div>
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <div
          className={`ai-assistant-sidebar fixed left-0 top-0 h-full w-56 transition-all duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 md:relative md:w-64 lg:w-72`}
        >
          {/* Sidebar Content */}
          <div className="flex flex-col h-full p-6">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white mb-1">AI Assistant</h2>
              <p className="text-sm text-blue-300/80">Your intelligent companion</p>
            </div>

            {/* Quick Actions Menu */}
            <div className="flex-1">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={index}
                    className="ai-assistant-button w-full py-3 px-4 mb-2 flex items-center gap-3 text-white hover:bg-white/15"
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                );
              })}
            </div>

            {/* User Profile Section */}
            <div className="border-t border-white/10 pt-4">
              <button className="ai-assistant-button w-full py-3 px-4 flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-white">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-blue-300/60">Active</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col w-full md:w-auto">
          {/* Header */}
          <div className="border-b border-white/5 bg-white/5 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {sidebarOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>
              <h1 className="text-lg font-bold text-white">AI Assistant</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400/20 to-cyan-400/20 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-blue-300" />
                  </div>
                  <p className="text-blue-200/60 font-medium">
                    Start a conversation...
                  </p>
                  <p className="text-blue-300/40 text-sm mt-2">
                    Ask me anything and I'll help you out
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                          : "ai-assistant-glass text-blue-100"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === "user"
                            ? "text-blue-100/60"
                            : "text-blue-300/50"
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="ai-assistant-glass px-4 py-3 rounded-2xl">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-100"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-white/5 bg-white/5 backdrop-blur-xl px-6 py-4">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="ai-assistant-glass-input w-full pr-12 py-3 bg-white/5 border-white/10 text-white placeholder-white/40"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <Button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="ai-assistant-button-primary px-6 py-2 h-auto"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-[5]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
