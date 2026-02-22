"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, MessageSquare, Hash, Save, Info } from "lucide-react";
import { api, ChannelPromptItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PromptsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<ChannelPromptItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [newChannelId, setNewChannelId] = useState("");
  const [newGuildId, setNewGuildId] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    loadPrompts();
  }, [token]);

  async function loadPrompts() {
    try {
      const data = await api.getChannelPrompts(token!);
      setPrompts(data);
    } catch (err) {
      toast.error("Failed to load channel prompts");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!token || !newChannelId || !newGuildId || !newPrompt) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await api.updateChannelPrompt(token, {
        channel_id: newChannelId,
        guild_id: newGuildId,
        system_prompt: newPrompt,
      });
      toast.success("Channel prompt updated");
      setNewChannelId("");
      setNewGuildId("");
      setNewPrompt("");
      loadPrompts();
    } catch (err) {
      toast.error("Failed to update prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(channelId: string) {
    if (!token) return;
    try {
      await api.deleteChannelPrompt(token, channelId);
      toast.success("Prompt removed");
      loadPrompts();
    } catch (err) {
      toast.error("Failed to remove prompt");
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
        <h1 className="text-2xl font-bold">Channel Personalities</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Add/Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Set Channel Personality
            </CardTitle>
            <CardDescription>
              Assign a specific system prompt to a channel to override the global personality.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guild-id" className="flex items-center gap-2">
                  Server ID
                </Label>
                <Input
                  id="guild-id"
                  placeholder="Server ID"
                  value={newGuildId}
                  onChange={(e) => setNewGuildId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-id" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Channel ID
                </Label>
                <Input
                  id="channel-id"
                  placeholder="Channel ID"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="How should the bot behave in this channel?"
                rows={5}
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
              />
            </div>

            <Button onClick={handleAdd} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Channel Personality
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50 border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p>
              By default, SparkSage uses the <strong>Global System Prompt</strong> defined in Settings.
            </p>
            <p>
              Custom personalities allow you to make the bot behave differently in specific channels:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>A <strong>#coding</strong> channel could have a "concise, technical expert" persona.</li>
              <li>A <strong>#lounge</strong> channel could be "funny and laid back".</li>
              <li>A <strong>#support</strong> channel could be "formal and patient".</li>
            </ul>
            <p className="italic">
              Users can also use <code>/prompt set</code> directly in Discord if they have administrator permissions.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Channels</CardTitle>
        </CardHeader>
        <CardContent>
          {prompts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-4 opacity-20" />
              <p>No custom channel personalities configured yet.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel ID</TableHead>
                    <TableHead>Server ID</TableHead>
                    <TableHead>Personality Summary</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompts.map((p) => (
                    <TableRow key={p.channel_id}>
                      <TableCell className="font-mono text-xs">{p.channel_id}</TableCell>
                      <TableCell className="font-mono text-xs">{p.guild_id}</TableCell>
                      <TableCell className="max-w-md truncate text-sm">
                        {p.system_prompt}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setNewChannelId(p.channel_id);
                            setNewGuildId(p.guild_id);
                            setNewPrompt(p.system_prompt);
                          }}
                          className="mr-1"
                          title="Edit"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p.channel_id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
