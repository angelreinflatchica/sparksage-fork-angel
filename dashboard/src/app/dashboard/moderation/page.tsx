"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, ShieldAlert, Hash, Power, PowerOff, Info, Sliders } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export default function ModerationPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [sensitivity, setSensitivity] = useState("medium");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    api.getConfig(token).then(({ config }) => {
      setEnabled(config.MODERATION_ENABLED === "1");
      setChannelId(config.MOD_LOG_CHANNEL_ID || "");
      setSensitivity(config.MODERATION_SENSITIVITY || "medium");
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load configuration");
      setLoading(false);
    });
  }, [token]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateConfig(token, {
        MODERATION_ENABLED: enabled ? "1" : "0",
        MOD_LOG_CHANNEL_ID: channelId,
        MODERATION_SENSITIVITY: sensitivity,
      });
      toast.success("Moderation settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content Moderation</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              AI Sentinel
            </CardTitle>
            <CardDescription>
              Analyze messages for toxicity, spam, and rule violations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Auto-Moderation</Label>
                <p className="text-xs text-muted-foreground">
                  Status: {enabled ? "Scanning Messages" : "Inactive"}
                </p>
              </div>
              <Button 
                variant={enabled ? "default" : "outline"}
                onClick={() => setEnabled(!enabled)}
                className="w-32"
              >
                {enabled ? (
                  <><Power className="mr-2 h-4 w-4" /> Enabled</>
                ) : (
                  <><PowerOff className="mr-2 h-4 w-4" /> Disabled</>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <Label htmlFor="channel" className="flex items-center gap-2">
                <Hash className="h-4 w-4" /> Mod Log Channel ID
              </Label>
              <Input
                id="channel"
                placeholder="e.g. 123456789012345678"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Sliders className="h-4 w-4" /> Moderation Sensitivity
              </Label>
              <RadioGroup value={sensitivity} onValueChange={setSensitivity} className="grid grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="low" id="low" className="peer sr-only" />
                  <Label
                    htmlFor="low"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="text-sm font-semibold">Low</span>
                    <span className="text-[10px] text-muted-foreground text-center">Severe only</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="medium" id="medium" className="peer sr-only" />
                  <Label
                    htmlFor="medium"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="text-sm font-semibold">Medium</span>
                    <span className="text-[10px] text-muted-foreground text-center">Balanced</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="high" id="high" className="peer sr-only" />
                  <Label
                    htmlFor="high"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="text-sm font-semibold">High</span>
                    <span className="text-[10px] text-muted-foreground text-center">Strict</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="text-muted-foreground space-y-1">
                <p>
                  SparkSage uses AI to analyze message intent. Flagged content is never 
                  automatically deleted—it is sent to the moderation log with action buttons 
                  (Delete, Warn, Dismiss) for human review.
                </p>
                <p>
                  <strong>Low:</strong> Only flags extreme toxicity or obvious spam.<br/>
                  <strong>Medium:</strong> Flags general toxicity, insults, and repetitive spam.<br/>
                  <strong>High:</strong> Flags even minor instances of negativity or borderline spam.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
