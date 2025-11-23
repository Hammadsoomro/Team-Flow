import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { ChatContactList } from "@/components/chat/ChatContactList";
import { ChatArea } from "@/components/chat/ChatArea";
import type { User, ChatGroup } from "@shared/api";

export default function TeamChat() {
  const { user, token } = useAuth();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [groupChat, setGroupChat] = useState<ChatGroup | null>(null);
  const [selectedChat, setSelectedChat] = useState<{
    type: "group" | "direct";
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>(
    {},
  );

  // Fetch team members and group chat
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;

      try {
        // Request notification permission
        if (Notification.permission === "default") {
          Notification.requestPermission();
        }

        const [membersRes, groupRes] = await Promise.all([
          fetch("/api/members", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/chat/group", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (membersRes.ok) {
          const members = await membersRes.json();
          if (Array.isArray(members)) {
            // Filter out current user from the list
            setTeamMembers(members.filter((m: User) => m._id !== user?._id));
          } else {
            console.error("Members response is not an array:", members);
            setTeamMembers([]);
          }
        } else {
          console.error(
            `Members API error: ${membersRes.status} ${membersRes.statusText}`,
          );
          const text = await membersRes.text();
          console.error("Response preview:", text.substring(0, 300));
          setTeamMembers([]);
        }

        if (groupRes.ok) {
          const group = await groupRes.json();
          setGroupChat(group);
          setSelectedChat({
            type: "group",
            id: group._id,
            name: group.name,
          });
        } else {
          console.error(
            `Group chat API error: ${groupRes.status} ${groupRes.statusText}`,
          );
          const text = await groupRes.text();
          console.error("Response preview:", text.substring(0, 300));
        }
      } catch (error) {
        console.error("Error fetching chat data:", error);
        setTeamMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, user?._id]);

  const handleSelectMember = (member: User) => {
    if (member._id === user?._id) return;

    setSelectedChat({
      type: "direct",
      id: member._id,
      name: member.name,
    });

    // Clear unread count for this member when selected
    setUnreadCounts((prev) => ({
      ...prev,
      [member._id]: 0,
    }));
  };

  const handleNewMessage = (chatId: string) => {
    // Only increment unread if this chat is not selected
    if (selectedChat?.id !== chatId) {
      setUnreadCounts((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || 0) + 1,
      }));
    }
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
              members={teamMembers}
              groupChat={groupChat}
              selectedChat={selectedChat}
              onSelectMember={handleSelectMember}
              onSelectGroup={() => {
                if (groupChat) {
                  setSelectedChat({
                    type: "group",
                    id: groupChat._id,
                    name: groupChat.name,
                  });
                  // Clear unread count for group when selected
                  setUnreadCounts((prev) => ({
                    ...prev,
                    [groupChat._id]: 0,
                  }));
                }
              }}
              unreadCounts={unreadCounts}
            />
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <ChatArea
                selectedChat={selectedChat}
                token={token}
                onNewMessage={handleNewMessage}
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
