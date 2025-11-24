import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  CheckCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { ChatMessage } from "@shared/api";
import { io, Socket } from "socket.io-client";

interface ChatAreaProps {
  selectedChat: {
    type: "group" | "direct";
    id: string;
    name: string;
  };
  token: string | null;
  onNewMessage?: (chatId: string) => void;
}

interface TypingIndicator {
  userId: string;
  senderName: string;
  isTyping: boolean;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// Play notification sound
const playNotificationSound = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.5,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error("Error playing notification sound:", error);
  }
};

export function ChatArea({ selectedChat, token, onNewMessage }: ChatAreaProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(
    new Map(),
  );
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token || !user?._id) {
      console.error("Cannot connect to WebSocket:", {
        hasToken: !!token,
        hasUserId: !!user?._id,
      });
      return;
    }

    console.log("Attempting WebSocket connection with token:", {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 50) + "...",
      userId: user._id,
    });

    // Create socket connection
    // Try WebSocket first, then fall back to polling
    const socketUrl = window.location.origin;

    // For better compatibility with some hosting providers, try polling first
    // if WebSocket fails
    const transports = window.location.protocol === "https:"
      ? ["websocket", "polling"]
      : ["websocket", "polling"];

    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
      transports: transports,
      path: "/socket.io/",
      forceNew: false,
      multiplex: true,
      autoConnect: true,
      // Add explicit WebSocket settings
      upgrade: true,
      rememberUpgrade: false,
    });

    socketRef.current = socket;

    // Socket event listeners
    socket.on("connect", () => {
      console.log("✅ Connected to WebSocket server successfully");
      // Join the chat room
      socket.emit("join-chat", {
        chatId: selectedChat.id,
        userId: user._id,
      });
      // Fetch initial messages
      fetchInitialMessages();
    });

    // Fallback: if socket doesn't connect within 5 seconds, fetch messages via HTTP
    const connectTimeoutId = setTimeout(() => {
      if (!socket.connected) {
        console.warn("Socket not connected after 5 seconds, fetching messages via HTTP...");
        fetchInitialMessages();
      }
    }, 5000);

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from WebSocket:", reason);
    });

    socket.on("new-message", (data: any) => {
      const newMsg: ChatMessage = {
        _id: data.messageId || data._id,
        sender: data.sender,
        senderName: data.senderName,
        senderPicture: data.senderPicture,
        content: data.content,
        createdAt: data.timestamp || data.createdAt,
        groupId: data.groupId,
        recipient: data.recipient,
        readBy: data.readBy || [],
      };
      setMessages((prev) => [...prev, newMsg]);

      // Handle notifications and unread counter
      if (data.sender !== user?._id) {
        onNewMessage?.(selectedChat.id);

        // Show notification toast
        toast.info(`New message from ${data.senderName}`, {
          description: data.content.substring(0, 50),
        });

        // Play notification sound
        playNotificationSound();

        // Browser notification if permitted
        if (Notification.permission === "granted") {
          new Notification(`Message from ${data.senderName}`, {
            body: data.content,
            icon: data.senderPicture,
          });
        }
      }
    });

    socket.on("message-edited", (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? {
                ...msg,
                content: data.content,
                editedAt: new Date().toISOString(),
              }
            : msg,
        ),
      );
    });

    socket.on("message-deleted", (data: any) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    });

    socket.on("message-read", (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? {
                ...msg,
                readBy: [...(msg.readBy || []), data.userId],
              }
            : msg,
        ),
      );
    });

    socket.on("user-typing", (data: any) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          const updated = new Map(prev);
          updated.set(data.userId, {
            userId: data.userId,
            senderName: data.senderName,
            isTyping: true,
          });
          return updated;
        });

        // Auto-remove typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const updated = new Map(prev);
            updated.delete(data.userId);
            return updated;
          });
        }, 3000);
      } else {
        setTypingUsers((prev) => {
          const updated = new Map(prev);
          updated.delete(data.userId);
          return updated;
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    socket.on("connect_error", (error: any) => {
      console.error("WebSocket connection error:", error);
      const errorMessage =
        error?.data?.content || error?.message || String(error);
      console.error("Connection error details:", errorMessage);

      // Log for debugging
      console.error("Full error object:", {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        type: error?.type,
      });

      // Show user-friendly error message
      if (errorMessage.includes("token") || errorMessage.includes("auth")) {
        console.error("Authentication error - token may be invalid or expired");
      }
    });

    socket.on("error", (error: any) => {
      console.error("Socket.IO error event:", error);
    });

    socket.on("reconnect_attempt", () => {
      console.log("Attempting to reconnect to Socket.IO server...");
    });

    socket.on("reconnect_failed", () => {
      console.error("Failed to reconnect to Socket.IO server");
      toast.error("Unable to establish real-time connection. Using fallback mode.", {
        description: "Some features may not work in real-time",
      });
    });

    return () => {
      clearTimeout(connectTimeoutId);
      if (socket) {
        socket.emit("leave-chat", { chatId: selectedChat.id });
        socket.disconnect();
      }
    };
  }, [selectedChat.id, token, user?._id]);

  // Fetch initial messages
  const fetchInitialMessages = async () => {
    if (!token) {
      console.warn("No token available, skipping message fetch");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (selectedChat.type === "group") {
        params.append("groupId", selectedChat.id);
      } else {
        params.append("recipient", selectedChat.id);
      }

      console.log(`Fetching messages for ${selectedChat.type}:`, selectedChat.id);

      const response = await fetch(`/api/chat/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Messages fetch response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(`Fetched ${data.length} messages`);
        setMessages(Array.isArray(data) ? data.filter((msg: ChatMessage) => !msg.deleted) : []);
      } else {
        const errorText = await response.text();
        console.error(`Failed to fetch messages: ${response.status}`, errorText);
        toast.error("Failed to load messages", {
          description: `Server responded with status ${response.status}`,
        });
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Connection error", {
        description: "Failed to fetch messages. Check your connection.",
      });
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleTyping = () => {
    if (!socketRef.current) return;

    if (!isTyping) {
      socketRef.current.emit("typing", {
        chatId: selectedChat.id,
        userId: user?._id,
        senderName: user?.name || "Unknown",
        isTyping: true,
      });
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit("typing", {
          chatId: selectedChat.id,
          userId: user?._id,
          senderName: user?.name || "Unknown",
          isTyping: false,
        });
      }
      setIsTyping(false);
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !token || !socketRef.current) return;

    try {
      setSending(true);
      const payload: any = {
        content: newMessage,
      };

      if (selectedChat.type === "group") {
        payload.groupId = selectedChat.id;
      } else {
        payload.recipient = selectedChat.id;
      }

      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const sentMessage = await response.json();
        const messageId = sentMessage._id || sentMessage.insertedId;

        // Emit the message through WebSocket so all users see it in real-time
        socketRef.current.emit("send-message", {
          messageId,
          sender: user?._id,
          senderName: user?.name || "Unknown",
          chatId: selectedChat.id,
          content: newMessage,
          timestamp: new Date().toISOString(),
        });

        setNewMessage("");

        // Clear typing indicator
        socketRef.current.emit("typing", {
          chatId: selectedChat.id,
          userId: user?._id,
          senderName: user?.name || "Unknown",
          isTyping: false,
        });

        setIsTyping(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim() || !token || !socketRef.current) return;

    try {
      const response = await fetch("/api/chat/edit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId,
          content: editContent,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMessages(
          messages.map((msg) => (msg._id === messageId ? updated : msg)),
        );

        // Emit edit through WebSocket
        socketRef.current.emit("edit-message", {
          messageId,
          content: editContent,
          chatId: selectedChat.id,
        });

        setEditingId(null);
        setEditContent("");
      }
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!token || !socketRef.current) return;

    try {
      const response = await fetch("/api/chat/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId }),
      });

      if (response.ok) {
        setMessages(messages.filter((msg) => msg._id !== messageId));

        // Emit delete through WebSocket
        socketRef.current.emit("delete-message", {
          messageId,
          chatId: selectedChat.id,
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    if (!token || !socketRef.current) return;

    try {
      await fetch("/api/chat/mark-read", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId }),
      });

      // Emit read status through WebSocket
      socketRef.current.emit("message-read", {
        messageId,
        userId: user?._id,
      });
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg">{selectedChat.name}</h3>
        {selectedChat.type === "group" && (
          <p className="text-xs text-muted-foreground">
            Group Chat {socketRef.current?.connected ? "● Online" : "● Offline"}
          </p>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && typingUsers.size === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex gap-3 group ${
                    message.sender === user?._id ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.senderPicture} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {getInitials(message.senderName)}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={`flex flex-col gap-1 max-w-xs ${
                      message.sender === user?._id ? "items-end" : ""
                    }`}
                  >
                    <div className="flex gap-2 items-center">
                      {editingId === message._id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="h-8 text-sm max-w-xs"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleEditMessage(message._id)}
                            className="h-8 px-2"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            className="h-8 px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`px-3 py-2 rounded-lg text-sm ${
                              message.sender === user?._id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p>{message.content}</p>
                            {message.editedAt && (
                              <p className="text-xs opacity-70 mt-1">
                                (edited)
                              </p>
                            )}
                          </div>

                          {message.sender === user?._id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity">
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align={
                                  message.sender === user?._id ? "end" : "start"
                                }
                              >
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingId(message._id);
                                    setEditContent(message.content);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeleteMessage(message._id)
                                  }
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {message.senderName}
                      </span>
                      {message.sender === user?._id && (
                        <span className="text-xs text-muted-foreground">
                          {message.readBy && message.readBy.length > 0 ? (
                            <CheckCheck className="h-3 w-3 inline" />
                          ) : (
                            <Check className="h-3 w-3 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing Indicators */}
              {typingUsers.size > 0 && (
                <div className="flex gap-3 items-center text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{
                          animationDelay: `${i * 150}ms`,
                        }}
                      />
                    ))}
                  </div>
                  <span>
                    {Array.from(typingUsers.values())
                      .map((t) => t.senderName)
                      .join(", ")}
                    {typingUsers.size === 1 ? " is" : " are"} typing...
                  </span>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            disabled={sending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
