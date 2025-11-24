import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { ChatContactList } from "@/components/chat/ChatContactList";
import { ChatArea } from "@/components/chat/ChatArea";
import type { User, ChatGroup } from "@shared/api";
import { io, Socket } from "socket.io-client";

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

    // Listen for new messages from other users
    socket.on("new-message", (data: any) => {
      console.log("[TeamChat] Received message:", data);

      setConversations((prev) => {
        const updated = [...prev];
        const convIndex = updated.findIndex((c) => c.id === data.chatId);

        if (convIndex !== -1) {
          const conversation = updated[convIndex];

          // Only increment unread if this message is not from current user and chat is not selected
          if (data.sender !== user._id && selectedChat?.id !== data.chatId) {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;
            console.log(
              `[TeamChat] Unread count updated for ${conversation.name}: ${conversation.unreadCount}`,
            );
          }

          conversation.lastMessageTime = data.timestamp;

          // Move conversation to top
          const [moved] = updated.splice(convIndex, 1);
          updated.unshift(moved);
        }

        return updated;
      });

      // Play notification sound if message is not from current user
      if (data.sender !== user._id) {
        playNotificationSound();
      }
    });

    socket.on("connect", () => {
      console.log("[TeamChat] Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("[TeamChat] Socket disconnected");
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, user?._id, selectedChat?.id]);

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
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Short beep: frequency 800Hz, duration 200ms
      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);

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