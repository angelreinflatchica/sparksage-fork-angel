"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, Users, MessageSquare, Info, Power, PowerOff } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function OnboardingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    api.getConfig(token).then(({ config }) => {
      setEnabled(config.WELCOME_ENABLED === "1");
      setChannelId(config.WELCOME_CHANNEL_ID || "");
      setMessage(config.WELCOME_MESSAGE || "Welcome {user} to {server}!");
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
        WELCOME_ENABLED: enabled ? "1" : "0",
        WELCOME_CHANNEL_ID: channelId,
        WELCOME_MESSAGE: message,
      });
      toast.success("Onboarding settings saved");
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
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Welcome Flow
            </CardTitle>
            <CardDescription>
              Configure how the bot greets new members when they join your server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Welcome Message</Label>
                <p className="text-xs text-muted-foreground">
                  Status: {enabled ? "Currently Active" : "Currently Disabled"}
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

            <div className="space-y-2">
              <Label htmlFor="channel">Welcome Channel ID</Label>
              <Input
                id="channel"
                placeholder="e.g. 123456789012345678"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                The ID of the channel where the public welcome message will be posted. Leave empty to only send a DM.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Welcome Message Template</Label>
              <Textarea
                id="message"
                rows={5}
                placeholder="Welcome {user} to {server}!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold uppercase text-muted-foreground">Available Placeholders:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                    <li><code className="text-primary">{"{user}"}</code> - Mentions the new member</li>
                    <li><code className="text-primary">{"{server}"}</code> - The name of your Discord server</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-secondary/50 p-4">
              <p className="whitespace-pre-wrap text-sm italic">
                {message
                  .replace("{user}", "@NewMember")
                  .replace("{server}", "SparkSage Server")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
