"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function DiscordOAuthSuccessPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const guildId = searchParams.get("guild_id");
  const error = searchParams.get("error");
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [guildLookup, setGuildLookup] = useState<{ id: string; name: string | null } | null>(null);

  const isDenied = Boolean(error);

  useEffect(() => {
    if (!token || !guildId || isDenied) return;

    let cancelled = false;
    api.getBotGuilds(token)
      .then((resp) => {
        if (cancelled) return;
        const match = (resp.guilds || []).find((g) => g.id === guildId);
        setGuildLookup({ id: guildId, name: match?.name || null });
      })
      .catch(() => {
        if (!cancelled) setGuildLookup({ id: guildId, name: null });
      });

    return () => {
      cancelled = true;
    };
  }, [token, guildId, isDenied]);

  const serverLine = useMemo(() => {
    if (!guildId) {
      return "Server authorization completed. You can now configure server-specific settings from the dashboard.";
    }
    const resolvedName = guildLookup?.id === guildId ? guildLookup.name : null;
    if (resolvedName) {
      return `Server: ${resolvedName} (${guildId})`;
    }
    return `Server ID: ${guildId}`;
  }, [guildId, guildLookup]);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            {isDenied ? (
              <XCircle className="h-6 w-6 text-red-500" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            )}
            {isDenied ? "Discord Authorization Cancelled" : "Bot Connected to Discord"}
          </CardTitle>
          <CardDescription>
            {isDenied
              ? "The authorization flow was cancelled or denied."
              : "SparkSage has been authorized and is ready to use in your selected server."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {!isDenied && (
            <>
              <p>{serverLine}</p>
              {code && <p>Authorization code received successfully.</p>}
            </>
          )}
          {isDenied && (
            <p>
              You can retry from the Overview page using the <span className="font-medium text-foreground">Add to Discord</span> button.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link href="/dashboard">Back to Overview</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">Open Settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
