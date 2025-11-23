import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface SorterSettingsProps {
  token: string | null;
}

export function SorterSettings({ token }: SorterSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Settings states
  const [cooldownMinutes, setCooldownMinutes] = useState(5);
  const [linesClaim, setLinesClaim] = useState(5);

  // Fetch sorter settings
  useEffect(() => {
    if (!token) return;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/sorter/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setCooldownMinutes(data.cooldownMinutes || 5);
          setLinesClaim(data.linesClaim || 5);
        }
      } catch (error) {
        console.error("Error fetching sorter settings:", error);
        toast.error("Failed to fetch sorter settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [token]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/sorter/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cooldownMinutes,
          linesClaim,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      setHasChanges(false);
      toast.success("Sorter settings updated successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save sorter settings";
      toast.error(errorMessage);
      console.error("Save settings error:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading sorter settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cooldown Timer</CardTitle>
          <CardDescription>
            Set the global cooldown time for team members after claiming lines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Cooldown Duration: {cooldownMinutes} minute
                {cooldownMinutes !== 1 ? "s" : ""}
              </Label>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              value={cooldownMinutes}
              onChange={(e) => {
                setCooldownMinutes(parseInt(e.target.value));
                setHasChanges(true);
              }}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 min</span>
              <span>60 min</span>
            </div>
            <p className="text-sm text-muted-foreground">
              After a team member claims lines, they must wait this duration
              before claiming again.
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
              <Label className="text-base font-medium">
                Lines Per Claim: {linesClaim} line{linesClaim !== 1 ? "s" : ""}
              </Label>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={linesClaim}
              onChange={(e) => {
                setLinesClaim(parseInt(e.target.value));
                setHasChanges(true);
              }}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 line</span>
              <span>15 lines</span>
            </div>
            <p className="text-sm text-muted-foreground">
              When a team member clicks the claim button, they will claim this
              many lines from the queue. Claimed lines move immediately from
              Queued List to History.
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
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Current Configuration</p>
                <ul className="space-y-1">
                  <li>
                    • Global cooldown:{" "}
                    <strong>{cooldownMinutes} minute(s)</strong>
                  </li>
                  <li>
                    • Lines per claim: <strong>{linesClaim} line(s)</strong>
                  </li>
                  <li>• Claimed lines will move to History immediately</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="sticky bottom-0 flex gap-2 pt-4">
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            onClick={() => setHasChanges(false)}
            variant="outline"
            className="flex-1"
          >
            Discard Changes
          </Button>
        </div>
      )}
    </div>
  );
}
