"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, Cpu, Hash, Save, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { api, ChannelProviderItem, ProviderItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ChannelProvidersPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<ChannelProviderItem[]>([]);
  const [availableProviders, setAvailableProviders] = useState<ProviderItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [newChannelId, setNewChannelId] = useState("");
  const [newGuildId, setNewGuildId] = useState("");
  const [newProvider, setNewProvider] = useState("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    try {
      const [providersData, mappingsData] = await Promise.all([
        api.getProviders(token!),
        api.getChannelProviders(token!),
      ]);
      setAvailableProviders(providersData.providers);
      setMappings(mappingsData);
    } catch (err) {
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!token || !newChannelId || !newGuildId || !newProvider) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await api.updateChannelProvider(token, {
        channel_id: newChannelId,
        guild_id: newGuildId,
        provider: newProvider,
      });
      toast.success("Channel provider updated");
      setNewChannelId("");
      setNewGuildId("");
      setNewProvider("");
      loadData();
    } catch (err) {
      toast.error("Failed to update channel provider");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(channelId: string) {
    if (!token) return;
    try {
      await api.deleteChannelProvider(token, channelId);
      toast.success("Channel mapping removed");
      loadData();
    } catch (err) {
      toast.error("Failed to remove mapping");
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
        <h1 className="text-2xl font-bold">Channel Provider Overrides</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Add/Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Set Channel Provider
            </CardTitle>
            <CardDescription>
              Force a specific channel to use a different AI model than the global default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guild-id">Server ID</Label>
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
              <Label htmlFor="provider">AI Provider</Label>
              <select
                id="provider"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>Select a model...</option>
                {availableProviders.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.configured}>
                    {p.display_name} {!p.configured ? "(Not Configured)" : ""} {p.is_primary ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleAdd} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Override
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50 border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Use Cases
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p>
              By default, SparkSage uses the <strong>Primary Provider</strong> defined in the Providers tab.
            </p>
            <p>
              Channel overrides are useful when:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>A <strong>#creative-writing</strong> channel needs a specific high-quality model like Claude or GPT-4.</li>
              <li>A <strong>#general</strong> channel should use a fast/free model like Gemini Flash to save costs.</li>
              <li>A <strong>#support</strong> channel uses a specialized model optimized for documentation.</li>
            </ul>
            <p className="italic">
              Users can also use <code>/channel-provider set</code> directly in Discord if they have administrator permissions.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Cpu className="mx-auto h-8 w-8 mb-4 opacity-20" />
              <p>No channel-specific overrides configured yet.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel ID</TableHead>
                    <TableHead>Server ID</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => {
                    const provider = availableProviders.find(p => p.name === m.provider);
                    return (
                      <TableRow key={m.channel_id}>
                        <TableCell className="font-mono text-xs">{m.channel_id}</TableCell>
                        <TableCell className="font-mono text-xs">{m.guild_id}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{provider?.display_name || m.provider}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{provider?.model || 'Unknown Model'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {provider?.configured ? (
                            <div className="flex items-center text-green-600 gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </div>
                          ) : (
                            <div className="flex items-center text-amber-600 gap-1 text-xs">
                              <AlertCircle className="h-3 w-3" /> Missing Key
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setNewChannelId(m.channel_id);
                              setNewGuildId(m.guild_id);
                              setNewProvider(m.provider);
                            }}
                            className="mr-1"
                            title="Edit"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(m.channel_id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
