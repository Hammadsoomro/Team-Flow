import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Users, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { User, ChatGroup } from "@shared/api";

interface ChatContactListProps {
  members: User[];
  groupChat: ChatGroup | null;
  selectedChat: {
    type: "group" | "direct";
    id: string;
    name: string;
  } | null;
  onSelectMember: (member: User) => void;
  onSelectGroup: () => void;
  unreadCounts?: { [key: string]: number };
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function ChatContactList({
  members,
  groupChat,
  selectedChat,
  onSelectMember,
  onSelectGroup,
  unreadCounts = {},
}: ChatContactListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>

      {/* Contacts List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Group Chat */}
          {groupChat && (
            <button
              onClick={onSelectGroup}
              className={`w-full p-3 rounded-lg transition-colors flex items-center gap-3 ${
                selectedChat?.type === "group" &&
                selectedChat?.id === groupChat._id
                  ? "bg-primary/10"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center relative">
                  <Users className="h-5 w-5 text-primary" />
                  {unreadCounts[groupChat._id] ? (
                    <Badge
                      variant="default"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {unreadCounts[groupChat._id]}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{groupChat.name}</p>
                <p className="text-xs text-muted-foreground">
                  {groupChat.members.length} members
                </p>
              </div>
            </button>
          )}

          {/* Divider */}
          {groupChat && members.length > 0 && (
            <div className="my-2 border-t border-border" />
          )}

          {/* Direct Messages */}
          {members.map((member) => (
            <button
              key={member._id}
              onClick={() => onSelectMember(member)}
              className={`w-full p-3 rounded-lg transition-colors flex items-center gap-3 ${
                selectedChat?.type === "direct" &&
                selectedChat?.id === member._id
                  ? "bg-primary/10"
                  : "hover:bg-muted"
              }`}
            >
              <div className="relative">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage
                    src={member.profilePictureUrl || member.profilePicture}
                  />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                {unreadCounts[member._id] ? (
                  <Badge
                    variant="default"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCounts[member._id]}
                  </Badge>
                ) : null}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </button>
          ))}

          {members.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No team members yet
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
