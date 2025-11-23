import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import type { HistoryEntry } from "@shared/api";

export default function History() {
  const { token, user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredEntries, setFilteredEntries] = useState<HistoryEntry[]>([]);

  // Fetch history entries
  useEffect(() => {
    const fetchHistory = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch("/api/history", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          console.error(
            `History API error: ${response.status} ${response.statusText}`,
          );
          const text = await response.text();
          console.error("Response preview:", text.substring(0, 300));
          setEntries([]);
          setFilteredEntries([]);
          return;
        }

        const data = await response.json();
        setEntries(data.entries || []);
        setFilteredEntries(data.entries || []);
      } catch (error) {
        console.error("Error fetching history:", error);
        setEntries([]);
        setFilteredEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [token]);

  // Filter entries based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEntries(entries);
    } else {
      const filtered = entries.filter((entry) =>
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredEntries(filtered);
    }
  }, [searchQuery, entries]);

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
              <Clock className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">History</h1>
            </div>
            <p className="text-muted-foreground">
              Track and search claimed numbers with filters and timestamps
            </p>
          </div>

          {/* Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Total Entries
              </div>
              <div className="text-3xl font-bold text-foreground">
                {entries.length}
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Today's Entries
              </div>
              <div className="text-3xl font-bold text-foreground">
                {
                  entries.filter((e) => {
                    const today = new Date();
                    const entryDate = new Date(e.claimedAt);
                    return entryDate.toDateString() === today.toDateString();
                  }).length
                }
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Searched Results
              </div>
              <div className="text-3xl font-bold text-foreground">
                {filteredEntries.length}
              </div>
            </Card>
          </div>

          {/* Admin Info - Show who can see what */}
          {isAdmin && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                You are viewing all team history entries including those claimed
                by team members
              </p>
            </div>
          )}

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search history entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                Loading history...
              </div>
            </Card>
          ) : filteredEntries.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No entries match your search"
                    : "No history entries yet"}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <Card
                  key={entry._id}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        {entry.content}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Claimed by: {entry.claimedByName || entry.claimedBy}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.claimedAt)}
                    </div>
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
