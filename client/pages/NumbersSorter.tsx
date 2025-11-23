import { Layout } from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Trash2, Plus, Copy, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export default function NumbersSorter() {
  const { token, isAdmin } = useAuth();
  const [inputNumbers, setInputNumbers] = useState<string>("");
  const [deduplicated, setDeduplicated] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [settings, setSettings] = useState({
    lineCount: 5,
    cooldownMinutes: 30,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedInput = localStorage.getItem("sorterInput");
    if (savedInput) setInputNumbers(savedInput);

    const savedDeduplicated = localStorage.getItem("sorterDeduplicated");
    if (savedDeduplicated) {
      try {
        setDeduplicated(JSON.parse(savedDeduplicated));
      } catch (error) {
        console.error("Error loading deduplicated lines:", error);
      }
    }
  }, []);

  // Load settings from server
  useEffect(() => {
    const loadSettings = async () => {
      if (!token) return;

      try {
        const response = await fetch("/api/sorter/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setSettings({
            lineCount: data.lineCount || 5,
            cooldownMinutes: data.cooldownMinutes || 30,
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, [token]);

  // Save to localStorage when input changes
  useEffect(() => {
    localStorage.setItem("sorterInput", inputNumbers);
  }, [inputNumbers]);

  // Save deduplicated lines to localStorage when they change
  useEffect(() => {
    localStorage.setItem("sorterDeduplicated", JSON.stringify(deduplicated));
  }, [deduplicated]);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem("sorterSettings", JSON.stringify(settings));
  }, [settings]);

  // Load settings from localStorage on mount (before server fetch)
  useEffect(() => {
    const savedSettings = localStorage.getItem("sorterSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error("Error loading saved settings:", error);
      }
    }
  }, []);

  const deduplicateLines = async () => {
    if (!token) {
      toast.error("Authentication required");
      return;
    }

    const lines = inputNumbers.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      toast.error("Please enter some numbers first");
      return;
    }

    try {
      setIsDeduplicating(true);

      // Fetch queued lines
      const queuedResponse = await fetch("/api/queued", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const queuedData = queuedResponse.ok ? await queuedResponse.json() : {};
      const queuedLines = new Set(
        (queuedData.lines || []).map((line: any) =>
          line.content.trim().toLowerCase(),
        ),
      );

      // Fetch history entries (only admin's own entries for deduplication)
      const historyResponse = await fetch("/api/history", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const historyData = historyResponse.ok
        ? await historyResponse.json()
        : {};
      const historyLines = new Set(
        (historyData.entries || []).map((entry: any) =>
          entry.content.trim().toLowerCase(),
        ),
      );

      // Get first 15 words of each line for comparison
      const getFirstWords = (text: string) => {
        return text.split(/\s+/).slice(0, 15).join(" ");
      };

      // Deduplicate: keep only first occurrence of each unique set of first 15 words
      // AND exclude lines that are already in queued list or history
      const seen = new Set<string>();
      const unique: string[] = [];

      lines.forEach((line) => {
        const trimmedLine = line.trim().toLowerCase();
        const key = getFirstWords(trimmedLine);

        // Check if not already seen, and not in queued list or history
        if (
          !seen.has(key) &&
          !queuedLines.has(trimmedLine) &&
          !historyLines.has(trimmedLine)
        ) {
          seen.add(key);
          unique.push(line);
        }
      });

      setDeduplicated(unique);

      if (unique.length === 0) {
        toast.info("All lines already exist in Queued List or History");
      } else {
        toast.success(`${unique.length} unique lines after deduplication`);
      }
    } catch (error) {
      console.error("Error deduplicating lines:", error);
      toast.error("Failed to deduplicate lines");
    } finally {
      setIsDeduplicating(false);
    }
  };

  const addToQueue = async () => {
    if (deduplicated.length === 0) {
      toast.error("Please deduplicate some lines first");
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch("/api/queued/add", {
        method: "POST",
        body: JSON.stringify({ lines: deduplicated }),
        token,
      });

      toast.success("Added to queue successfully!");
      setDeduplicated([]);
      setInputNumbers("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add to queue",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearInput = () => {
    setInputNumbers("");
    setDeduplicated([]);
  };

  const copyToClipboard = async () => {
    const text = deduplicated.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch (error) {
      alert("Failed to copy");
    }
  };

  const saveSettings = async () => {
    if (!token || !isAdmin) {
      toast.error("Admin access required");
      return;
    }

    try {
      setSavingSettings(true);
      const response = await fetch("/api/sorter/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineCount: Math.max(1, Math.min(100, settings.lineCount)),
          cooldownMinutes: Math.max(
            1,
            Math.min(1440, settings.cooldownMinutes),
          ),
        }),
      });

      if (response.ok) {
        toast.success("Settings updated successfully!");
      } else {
        toast.error("Failed to update settings");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update settings",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Numbers Sorter 🔢
            </h1>
            <p className="text-muted-foreground">
              Input numbers, deduplicate them, and add to queue
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Input */}
            <Card className="border-border/50 lg:row-span-2">
              <CardHeader>
                <CardTitle>Input Numbers</CardTitle>
                <CardDescription>
                  Paste your numbers here, one per line
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter numbers here..."
                  value={inputNumbers}
                  onChange={(e) => setInputNumbers(e.target.value)}
                  className="min-h-96 resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={deduplicateLines}
                    disabled={isDeduplicating}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    {isDeduplicating ? "Deduplicating..." : "Deduplicate"}
                  </Button>
                  <Button
                    onClick={clearInput}
                    variant="outline"
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: Deduplicated Lines */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Deduplicated Lines</CardTitle>
                <CardDescription>
                  {deduplicated.length} unique lines found
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/50 rounded-lg p-4 min-h-64 max-h-96 overflow-y-auto space-y-2 border border-border">
                  {deduplicated.length > 0 ? (
                    deduplicated.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-background rounded border border-border/50 hover:border-primary/50 transition-colors group"
                      >
                        <p className="text-sm text-foreground break-words">
                          {line}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>Deduplicated lines will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bottom: Actions */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={addToQueue}
                  disabled={deduplicated.length === 0 || isLoading}
                  className="w-full bg-primary hover:bg-primary/90 h-10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isLoading ? "Adding..." : "Add to Queued List"}
                </Button>
                <Button
                  onClick={copyToClipboard}
                  disabled={deduplicated.length === 0}
                  variant="outline"
                  className="w-full h-10"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>

                {/* Statistics */}
                <div className="mt-6 pt-6 border-t border-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Input Lines:
                    </span>
                    <span className="font-semibold text-foreground">
                      {inputNumbers.split("\n").filter((l) => l.trim()).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Unique Lines:
                    </span>
                    <span className="font-semibold text-foreground text-primary">
                      {deduplicated.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Duplicates Removed:
                    </span>
                    <span className="font-semibold text-foreground">
                      {Math.max(
                        0,
                        inputNumbers.split("\n").filter((l) => l.trim())
                          .length - deduplicated.length,
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Sorter Settings Section */}
          {isAdmin && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Sorter Configuration
                </h2>
                <p className="text-muted-foreground">
                  Configure team settings for the numbers sorter
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cooldown Timer</CardTitle>
                  <CardDescription>
                    Set the global cooldown time for team members after claiming
                    lines
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-foreground">
                        Cooldown Duration: {settings.cooldownMinutes} minute
                        {settings.cooldownMinutes !== 1 ? "s" : ""}
                      </label>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={settings.cooldownMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          cooldownMinutes: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 min</span>
                      <span>60 min</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      After a team member claims lines, they must wait this
                      duration before claiming again.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lines Per Claim</CardTitle>
                  <CardDescription>
                    Set how many lines team members can claim in one action
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-foreground">
                        Lines Per Claim: {settings.lineCount} line
                        {settings.lineCount !== 1 ? "s" : ""}
                      </label>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={settings.lineCount}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          lineCount: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 line</span>
                      <span>15 lines</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When a team member clicks the claim button, they will
                      claim this many lines from the queue. Claimed lines move
                      immediately from Queued List to History.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuration Summary</CardTitle>
                  <CardDescription>Current settings overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-medium mb-2">
                          Current Configuration
                        </p>
                        <ul className="space-y-1">
                          <li>
                            • Global cooldown:{" "}
                            <strong>
                              {settings.cooldownMinutes} minute(s)
                            </strong>
                          </li>
                          <li>
                            • Lines per claim:{" "}
                            <strong>{settings.lineCount} line(s)</strong>
                          </li>
                          <li>
                            • Claimed lines will move to History immediately
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full bg-primary hover:bg-primary/90 h-10"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
