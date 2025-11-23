import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Lock,
  LockOpen,
} from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  blocked: boolean;
  createdAt: string;
}

interface TeamManagementProps {
  token: string | null;
}

export function TeamManagement({ token }: TeamManagementProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Fetch team members
  useEffect(() => {
    if (!token) return;

    const fetchMembers = async () => {
      try {
        setMembersLoading(true);
        const response = await fetch("/api/team/members", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error("Error fetching team members:", error);
        toast.error("Failed to fetch team members");
      } finally {
        setMembersLoading(false);
      }
    };

    fetchMembers();
  }, [token]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      toast.error("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/team/create-member", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create member");
      }

      const data = await response.json();
      setMembers([data.member, ...members]);
      setShowCreateForm(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      toast.success("Team member created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create member",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = async (memberId: string) => {
    try {
      setLoading(true);
      const response = await fetch("/api/team/edit-member", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          name: editName,
          email: editEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update member");
      }

      setMembers(
        members.map((m) =>
          m._id === memberId ? { ...m, name: editName, email: editEmail } : m,
        ),
      );
      setEditingId(null);
      toast.success("Member updated successfully");
    } catch (error) {
      toast.error("Failed to update member");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (
    memberId: string,
    currentBlocked: boolean,
  ) => {
    try {
      const response = await fetch("/api/team/toggle-block", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          blocked: !currentBlocked,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle block");
      }

      setMembers(
        members.map((m) =>
          m._id === memberId ? { ...m, blocked: !currentBlocked } : m,
        ),
      );
      toast.success(
        `Member ${!currentBlocked ? "blocked" : "unblocked"} successfully`,
      );
    } catch (error) {
      toast.error("Failed to toggle block");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this team member? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/team/remove-member", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      setMembers(members.filter((m) => m._id !== memberId));
      toast.success("Member removed successfully");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Member Card */}
      <Card>
        <CardHeader>
          <CardTitle>Create Team Member</CardTitle>
          <CardDescription>
            Add new team members to your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showCreateForm ? (
            <Button onClick={() => setShowCreateForm(true)} className="w-full">
              Create New Member
            </Button>
          ) : (
            <form onSubmit={handleCreateMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberEmail" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="memberEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberPassword" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="memberPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min 8 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmMemberPassword"
                  className="text-sm font-medium"
                >
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmMemberPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create Member"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage and view all team members in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading team members...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No team members yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    {editingId === member._id ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          size={1}
                        />
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          size={1}
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">
                          {member.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingId === member._id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleEditMember(member._id)}
                          disabled={loading}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(member._id);
                            setEditName(member.name);
                            setEditEmail(member.email);
                          }}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            handleToggleBlock(member._id, member.blocked)
                          }
                          title={
                            member.blocked ? "Unblock member" : "Block member"
                          }
                        >
                          {member.blocked ? (
                            <Lock className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <LockOpen className="h-4 w-4 text-green-600" />
                          )}
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveMember(member._id)}
                          title="Remove member"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
