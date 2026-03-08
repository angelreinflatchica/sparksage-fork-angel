"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ChannelItem } from "@/lib/api";
import { ChannelList } from "@/components/conversations/channel-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ConversationsPage() {
  const { data: session } = useSession();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [guildNamesById, setGuildNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const token = (session as { accessToken?: string })?.accessToken;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [conversationsResult, guildsResult, statusResult] = await Promise.allSettled([
        api.getConversations(token),
        api.getBotGuilds(token),
        api.getBotStatus(token),
      ]);

      if (conversationsResult.status === "fulfilled") {
        setChannels(conversationsResult.value.channels);
      }

      const guilds =
        guildsResult.status === "fulfilled"
          ? guildsResult.value.guilds
          : statusResult.status === "fulfilled"
            ? statusResult.value.guilds
            : [];

      const nextGuildNamesById: Record<string, string> = {};
      for (const guild of guilds) {
        nextGuildNamesById[guild.id] = guild.name;
      }
      setGuildNamesById(nextGuildNamesById);

      if (conversationsResult.status !== "fulfilled") {
        throw new Error("Failed to load conversations");
      }
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(channelId: string) {
    if (!token) return;
    try {
      await api.deleteConversation(token, channelId);
      toast.success(`Cleared conversation for #${channelId}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
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
      <h1 className="text-2xl font-bold">Conversations</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelList channels={channels} onDelete={handleDelete} guildNamesById={guildNamesById} />
        </CardContent>
      </Card>
    </div>
  );
}
