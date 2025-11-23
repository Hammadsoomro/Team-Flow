import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface InboxItem {
  _id: string;
  content: string;
  claimedAt: string;
  claimedByName?: string;
  cooldownUntil?: string;
  status: "claimed" | "cooldown" | "available";
}

interface ClaimedLine {
  _id: string;
  content: string;
  claimedAt: string;
  claimedByName: string;
}

export default function NumbersInbox() {
  const { token, user } = useAuth();
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [claimedLines, setClaimedLines] = useState<ClaimedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState(5);
  const [linesClaim, setLinesClaim] = useState(5);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>("");
  const [queuedLinesCount, setQueuedLinesCount] = useState(0);

  // Restore cooldown and claimed lines from localStorage on mount
  useEffect(() => {
    // Restore cooldown
    const storedCooldownUntil = localStorage.getItem("cooldownUntil");
    if (storedCooldownUntil) {
      const cooldownTime = new Date(storedCooldownUntil);
      const now = new Date();
      if (cooldownTime > now) {
        setCooldownUntil(storedCooldownUntil);
      } else {
        localStorage.removeItem("cooldownUntil");
      }
    }

    // Restore claimed lines
    const storedClaimedLines = localStorage.getItem("claimedLines");
    if (storedClaimedLines) {
      try {
        const parsedLines = JSON.parse(storedClaimedLines);
        setClaimedLines(parsedLines);
      } catch (error) {
        console.error("Failed to parse claimed lines from localStorage:", error);
        localStorage.removeItem("claimedLines");
      }
    }

    setLoading(false);
  }, []);

  // Fetch sorter settings and queued lines
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        // Fetch settings
        const settingsResponse = await fetch("/api/sorter/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          setCooldownMinutes(data.cooldownMinutes || 5);
          setLinesClaim(data.linesClaim || 5);
        }

        // Fetch queued lines count
        const queuedResponse = await fetch("/api/queued", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (queuedResponse.ok) {
          const queuedData = await queuedResponse.json();
          setQueuedLinesCount((queuedData.lines || []).length);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [token]);

  // Persist claimed lines to localStorage whenever they change
  useEffect(() => {
    if (claimedLines.length > 0) {
      localStorage.setItem("claimedLines", JSON.stringify(claimedLines));
    }
  }, [claimedLines]);

  // Update remaining time countdown
  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingTime("");
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const until = new Date(cooldownUntil);
      const diff = until.getTime() - now.getTime();

      if (diff <= 0) {
        setRemainingTime("");
        setCooldownUntil(null);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 0) {
        setRemainingTime(`${minutes}m ${seconds}s`);
      } else {
        setRemainingTime(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // Clear cooldown from localStorage when it expires
  useEffect(() => {
    if (!cooldownUntil && remainingTime === "") {
      localStorage.removeItem("cooldownUntil");
    }
  }, [cooldownUntil, remainingTime]);

  // Cleanup on component unmount - keep claimed lines and cooldown in localStorage
  // They should persist across navigation
  useEffect(() => {
    return () => {
      // Don't clear anything on unmount - data should persist
    };
  }, []);

  const handleClaimLines = async () => {
    if (!token || !user) {
      toast.error("You must be logged in to claim lines");
      return;
    }

    if (cooldownUntil && new Date() < new Date(cooldownUntil)) {
      toast.error("You are still in cooldown period");
      return;
    }

    try {
      setClaiming(true);
      const response = await fetch("/api/queued/claim", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lineCount: linesClaim }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to claim lines");
      }

      const data = await response.json();

      // Add claimed lines to display
      const newClaimedLines: ClaimedLine[] = data.lines.map((line: any) => ({
        _id: line._id || Math.random().toString(),
        content: line.content,
        claimedAt: line.claimedAt,
        claimedByName: user.name,
      }));

      setClaimedLines(newClaimedLines);

      // Update queued lines count
      setQueuedLinesCount(Math.max(0, queuedLinesCount - data.claimedCount));

      // Set cooldown and persist to localStorage
      const cooldownEnd = new Date(
        new Date().getTime() + cooldownMinutes * 60000,
      );
      const cooldownISOString = cooldownEnd.toISOString();
      setCooldownUntil(cooldownISOString);
      localStorage.setItem("cooldownUntil", cooldownISOString);

      toast.success(`Successfully claimed ${data.claimedCount} line(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to claim lines",
      );
      console.error("Claim lines error:", error);
    } finally {
      setClaiming(false);
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
              <Zap className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                Numbers Inbox
              </h1>
            </div>
            <p className="text-muted-foreground">
              Claim lines from the queue with cooldown timer
            </p>
          </div>

          {/* Claim Card */}
          <Card className="mb-8 p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">
                    Claim Lines
                  </h2>
                  <p className="text-muted-foreground">
                    {queuedLinesCount === 0
                      ? "No lines available in the queue"
                      : `${queuedLinesCount} line${queuedLinesCount !== 1 ? "s" : ""} available - Claim ${linesClaim} line${linesClaim !== 1 ? "s" : ""} from the queue`}
                  </p>
                </div>
              </div>

              {cooldownUntil && remainingTime && (
                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-900 dark:text-red-100">
                    <Clock className="h-5 w-5" />
                    <div>
                      <p className="font-semibold">Cooldown Active</p>
                      <p className="text-sm">
                        You can claim again in {remainingTime}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleClaimLines}
                disabled={
                  claiming ||
                  loading ||
                  (cooldownUntil && remainingTime !== "") ||
                  queuedLinesCount === 0
                }
                size="lg"
                className={`w-full font-semibold text-base transition-all ${
                  queuedLinesCount === 0
                    ? "bg-gray-500 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-600 text-white"
                    : cooldownUntil && remainingTime !== ""
                      ? "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                      : "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white"
                }`}
              >
                {claiming
                  ? "Claiming..."
                  : queuedLinesCount === 0
                    ? "No Lines Available"
                    : cooldownUntil && remainingTime
                      ? `On Cooldown (${remainingTime})`
                      : `Claim ${linesClaim} Line${linesClaim !== 1 ? "s" : ""}`}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Claimed lines will move automatically from Queue to History
              </p>
            </div>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Lines in Queue
              </div>
              <div className="text-3xl font-bold text-foreground">
                {queuedLinesCount}
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Total Claimed
              </div>
              <div className="text-3xl font-bold text-foreground">
                {claimedLines.length}
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">
                Claim Size
              </div>
              <div className="text-3xl font-bold text-primary">
                {linesClaim} line{linesClaim !== 1 ? "s" : ""}
              </div>
            </Card>
          </div>

          {/* Claimed Lines Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              Your Claimed Lines
            </h2>

            {loading ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">
                  Loading claimed lines...
                </div>
              </Card>
            ) : claimedLines.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No claimed lines yet. Click the claim button to start!
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {claimedLines.map((line) => (
                  <Card
                    key={line._id}
                    className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-primary"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-lg break-words">
                          {line.content}
                        </p>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <span>Claimed by: {line.claimedByName}</span>
                          <span className="hidden md:inline">•</span>
                          <span>{formatDate(line.claimedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-medium">Claimed</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
