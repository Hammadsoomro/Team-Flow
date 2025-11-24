import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { List, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { QueuedLine } from "@shared/api";

export default function QueuedList() {
  const { token, isAdmin } = useAuth();
  const [lines, setLines] = useState<QueuedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Fetch queued lines
  useEffect(() => {
    const fetchQueued = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch("/api/queued", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          console.error(
            `Queued lines API error: ${response.status} ${response.statusText}`,
          );
          const text = await response.text();
          console.error("Response preview:", text.substring(0, 300));
          setLines([]);
          return;
        }

        const data = await response.json();
        setLines(data.lines || []);
      } catch (error) {
        console.error("Error fetching queued lines:", error);
        setLines([]);
      } finally {
        setLoading(false);
      }
    };

    fetchQueued();
  }, [token]);

  const handleDeleteLine = async (lineId: string) => {
    if (!token) return;

    try {
      setDeletingId(lineId);
      const response = await fetch(`/api/queued/${lineId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setLines(lines.filter((line) => line._id !== lineId));
      }
    } catch (error) {
      console.error("Error deleting line:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!token) return;

    try {
      setIsClearingAll(true);
      const response = await fetch("/api/queued", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLines([]);
        setShowClearAllDialog(false);
        toast.success(`Cleared ${data.deletedCount} line(s) from queue`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to clear queue");
      }
    } catch (error) {
      console.error("Error clearing all lines:", error);
      toast.error("Failed to clear queue");
    } finally {
      setIsClearingAll(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Layout>
      <div className="min-h-screen p-6 md:p-8 bg-gradient-to-br from-background to-muted/30">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <List className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                Queued List
              </h1>
            </div>
            <p className="text-muted-foreground">
              View and manage numbers waiting to be claimed by team members
            </p>
          </div>

          {/* Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Total in Queue
              </div>
              <div className="text-3xl font-bold text-foreground">
                {lines.length}
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Waiting to Claim
              </div>
              <div className="text-3xl font-bold text-primary">
                {lines.length}
              </div>
            </Card>
          </div>

          {/* Content */}
          {loading ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                Loading queued lines...
              </div>
            </Card>
          ) : lines.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <List className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No items in queue</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {lines.map((line, index) => (
                <Card
                  key={line._id}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-lg">
                          {line.content}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Added by: {line.addedBy}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {formatDate(line.addedAt)}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLine(line._id)}
                        disabled={deletingId === line._id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingId === line._id ? "Deleting..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
