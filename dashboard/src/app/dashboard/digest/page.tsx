"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, Calendar, Clock, Hash, Power, PowerOff, Info } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DigestPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [time, setTime] = useState("09:00");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    api.getConfig(token).then(({ config }) => {
      setEnabled(config.DIGEST_ENABLED === "1");
      setChannelId(config.DIGEST_CHANNEL_ID || "");
      setTime(config.DIGEST_TIME || "09:00");
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
        DIGEST_ENABLED: enabled ? "1" : "0",
        DIGEST_CHANNEL_ID: channelId,
        DIGEST_TIME: time,
      });
      toast.success("Digest settings saved");
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
        <h1 className="text-2xl font-bold">Daily Digest</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduler
            </CardTitle>
            <CardDescription>
              Automatically summarize the past 24 hours of activity and post it to a channel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Daily Digest</Label>
                <p className="text-xs text-muted-foreground">
                  Status: {enabled ? "Active" : "Disabled"}
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Delivery Time (24h)
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Digest Channel ID
                </Label>
                <Input
                  id="channel"
                  placeholder="e.g. 123456789012345678"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <p className="text-muted-foreground">
                The digest will include a bullet-point summary of the top 5 most active channels 
                from the last 24 hours. The bot must have permission to view those channels 
                and send messages in the digest channel.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
