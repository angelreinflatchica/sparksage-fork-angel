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
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [guildChannels, setGuildChannels] = useState<{ id: string; name: string }[]>([]);
  const [guildLoading, setGuildLoading] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([api.getBotGuilds(token), api.getBotStatus(token)])
      .then(([guildsResult, statusResult]) => {
        let nextGuilds: { id: string; name: string }[] = [];
        if (guildsResult.status === "fulfilled") {
          nextGuilds = (guildsResult.value.guilds || []).map((g) => ({ id: g.id, name: g.name }));
        } else if (statusResult.status === "fulfilled") {
          nextGuilds = (statusResult.value.guilds || []).map((g) => ({ id: g.id, name: g.name }));
        }

        setGuilds(nextGuilds);
        if (nextGuilds.length > 0) {
          setSelectedGuildId(nextGuilds[0].id);
        }
      })
      .catch(() => toast.error("Failed to load server list"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedGuildId) return;
    setGuildLoading(true);

    Promise.allSettled([
      api.getConfig(token, selectedGuildId),
      api.getGuildChannels(token, selectedGuildId),
    ])
      .then(([configResult, channelsResult]) => {
        if (configResult.status === "fulfilled") {
          const cfg = configResult.value.config;
          setEnabled(cfg.WELCOME_ENABLED === "1");
          setChannelId(cfg.WELCOME_CHANNEL_ID || "");
          setMessage(cfg.WELCOME_MESSAGE || "Welcome {user} to {server}!");
        } else {
          toast.error("Failed to load onboarding settings for selected server");
        }

        if (channelsResult.status === "fulfilled") {
          setGuildChannels((channelsResult.value.channels || []).map((ch) => ({ id: ch.id, name: ch.name })));
        } else {
          setGuildChannels([]);
          toast.error("Failed to load channels for selected server");
        }
      })
      .finally(() => setGuildLoading(false));
  }, [token, selectedGuildId]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateConfig(token, {
        WELCOME_ENABLED: enabled ? "1" : "0",
        WELCOME_CHANNEL_ID: channelId,
        WELCOME_MESSAGE: message,
      }, selectedGuildId || undefined);
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
            <div className="space-y-2">
              <Label htmlFor="guild">Server</Label>
              <select
                id="guild"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedGuildId}
                onChange={(e) => setSelectedGuildId(e.target.value)}
              >
                <option value="">Select a server...</option>
                {guilds.map((guild) => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {guildLoading ? "Refreshing channels and onboarding settings..." : "Select a server to manage onboarding."}
              </p>
            </div>

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
              <Label htmlFor="channel">Welcome Channel</Label>
              <select
                id="channel"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                disabled={!selectedGuildId || guildLoading}
              >
                <option value="">No channel (DM only)</option>
                {guildChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Choose a channel by name for welcome posts. Leave as "No channel" to only send a DM.
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
                  .replace("{server}", guilds.find((g) => g.id === selectedGuildId)?.name || "SparkSage Server")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
