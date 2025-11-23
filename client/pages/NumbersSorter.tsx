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
  const { token } = useAuth();
  const [inputNumbers, setInputNumbers] = useState<string>("");
  const [deduplicated, setDeduplicated] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sorterInput");
    if (saved) setInputNumbers(saved);
  }, []);

  // Save to localStorage when input changes
  useEffect(() => {
    localStorage.setItem("sorterInput", inputNumbers);
  }, [inputNumbers]);

  const deduplicateLines = () => {
    const lines = inputNumbers.split("\n").filter((line) => line.trim());

    // Get first 15 words of each line for comparison
    const getFirstWords = (text: string) => {
      return text.split(/\s+/).slice(0, 15).join(" ");
    };

    // Deduplicate: keep only first occurrence of each unique set of first 15 words
    const seen = new Set<string>();
    const unique: string[] = [];

    lines.forEach((line) => {
      const key = getFirstWords(line);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(line);
      }
    });

    setDeduplicated(unique);
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
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Deduplicate
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
        </div>
      </div>
    </Layout>
  );
}
