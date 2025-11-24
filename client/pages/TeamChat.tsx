import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { ChatContactList } from "@/components/chat/ChatContactList";
import { ChatArea } from "@/components/chat/ChatArea";
import type { User, ChatGroup } from "@shared/api";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface ChatConversation {
  type: "group" | "direct";
  id: string;
  name: string;
  unreadCount: number;
  lastMessageTime?: string;
  member?: User;
  group?: ChatGroup;
}

export default function TeamChat() {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<{
    type: "group" | "direct";
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection and listen for messages
  useEffect(() => {
    if (!token || !user?._id) return;

    // Create shared socket instance
    const socket = io(window.location.origin, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Listen for new messages from other users (setup only once)
    const handleNewMessage = (data: any) => {
      console.log(
        "[TeamChat] Received message from",
        data.senderName,
        "in chat",
        data.chatId,
      );

      // Don't process messages from current user
      if (data.sender === user._id) {
        console.log("[TeamChat] Ignoring own message");
        return;
      }

      // Update conversations list
      setConversations((prev) => {
        const updated = [...prev];
        const convIndex = updated.findIndex((c) => c.id === data.chatId);

        if (convIndex !== -1) {
          const conversation = updated[convIndex];
          conversation.lastMessageTime = data.timestamp;

          // Move conversation to top
          const [moved] = updated.splice(convIndex, 1);
          updated.unshift(moved);

          return updated;
        }

        return prev;
      });

      // Check current selected chat and handle notifications
      setSelectedChat((currentSelected) => {
        const isCurrentChatSelected = currentSelected?.id === data.chatId;

        // Only show notifications if not viewing this chat
        if (!isCurrentChatSelected) {
          // Show toast notification
          toast.info(`New message from ${data.senderName}`, {
            description: data.content.substring(0, 100),
          });

          // Play notification sound
          playNotificationSound();

          // Increment unread count
          setConversations((prev) => {
            const updated = [...prev];
            const convIndex = updated.findIndex((c) => c.id === data.chatId);
            if (convIndex !== -1) {
              updated[convIndex].unreadCount =
                (updated[convIndex].unreadCount || 0) + 1;
              console.log(
                `[TeamChat] Unread: ${updated[convIndex].name} = ${updated[convIndex].unreadCount}`,
              );
            }
            return updated;
          });
        }

        return currentSelected;
      });
    };

    socket.on("new-message", handleNewMessage);

    socket.on("connect", () => {
      console.log("[TeamChat] Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("[TeamChat] Socket disconnected");
    });

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("connect");
      socket.off("disconnect");
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, user?._id]);

  // Fetch initial team members and group chat
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;

      try {
        const [membersRes, groupRes] = await Promise.all([
          fetch("/api/members", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/chat/group", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const convs: ChatConversation[] = [];

        // Add group chat
        if (groupRes.ok) {
          const group = await groupRes.json();
          convs.push({
            type: "group",
            id: group._id,
            name: group.name,
            unreadCount: 0,
            group,
          });
        }

        // Add direct messages
        if (membersRes.ok) {
          const members = await membersRes.json();
          members.forEach((member: User) => {
            if (member._id !== user?._id) {
              convs.push({
                type: "direct",
                id: member._id,
                name: member.name,
                unreadCount: 0,
                member,
              });
            }
          });
        }

        // Auto-select group chat if available
        if (convs.length > 0) {
          setSelectedChat({
            type: convs[0].type,
            id: convs[0].id,
            name: convs[0].name,
          });
        }

        setConversations(convs);
      } catch (error) {
        console.error("Error fetching chat data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, user?._id]);

  const playNotificationSound = () => {
    try {
      // Try using Web Audio API for better browser support
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      // Create two short beeps for notification
      const now = audioContext.currentTime;

      // Beep 1: 800Hz
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 800;
      osc1.type = "sine";
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Beep 2: 1000Hz (higher pitch)
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1000;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.35);

      console.log("[TeamChat] Notification sound played");
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  };

  const handleSelectChat = (conversation: ChatConversation) => {
    console.log("[TeamChat] Selected chat:", conversation.id);

    setSelectedChat({
      type: conversation.type,
      id: conversation.id,
      name: conversation.name,
    });

    // Mark as read - reset unread count
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversation.id ? { ...conv, unreadCount: 0 } : conv,
      ),
    );
  };

  return (
    <Layout>
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading chat...</div>
        </div>
      ) : (
        <div className="flex h-full gap-4 p-6">
          {/* Contact List */}
          <div className="w-80 border-r border-border">
            <ChatContactList
              conversations={conversations}
              selectedChat={selectedChat}
              onSelectChat={handleSelectChat}
            />
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <ChatArea
                selectedChat={selectedChat}
                token={token}
                socket={socketRef.current}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a chat to start messaging
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
