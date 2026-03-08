"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Activity, Cpu, Wifi, WifiOff, Server, ArrowRight, ShieldCheck, Calendar, Languages, Users, ExternalLink, Settings, Plug, MessagesSquare } from "lucide-react";
import { api } from "@/lib/api";
import type { BotStatus, ProvidersResponse, QuotaSummary, CostProviderSummary } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const DISCORD_CLIENT_ID = "1473885802227302410";
const DISCORD_BOT_PERMISSIONS = "2885120658966592";
const DISCORD_BOT_SCOPE = "bot applications.commands";
const DISCORD_OAUTH_BASE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_REDIRECT_URI = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI?.trim();

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [quotaSummary, setQuotaSummary] = useState<QuotaSummary | null>(null);
  const [costSummary, setCostSummary] = useState<CostProviderSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      api.getBotStatus(token),
      api.getProviders(token),
      api.getConfig(token),
      api.getQuotaSummary(token),
      api.getCostSummary(token),
    ]).then(([botResult, provResult, configResult, quotaResult, costResult]) => {
      if (botResult.status === "fulfilled") setBotStatus(botResult.value);
      if (provResult.status === "fulfilled") setProvidersData(provResult.value);
      if (configResult.status === "fulfilled") setConfig(configResult.value.config);
      if (quotaResult.status === "fulfilled") setQuotaSummary(quotaResult.value);
      if (costResult.status === "fulfilled") setCostSummary(costResult.value);
      setLoading(false);
    });
  }, [token]);

  const userQuotaLimit = quotaSummary?.limits.user_per_minute || 0;
  const guildQuotaLimit = quotaSummary?.limits.guild_per_minute || 0;
  const topUserUsed = quotaSummary?.users?.[0]?.used || 0;
  const topGuildUsed = quotaSummary?.guilds?.[0]?.used || 0;
  const userQuotaPct = userQuotaLimit > 0 ? Math.min(100, Math.round((topUserUsed / userQuotaLimit) * 100)) : 0;
  const guildQuotaPct = guildQuotaLimit > 0 ? Math.min(100, Math.round((topGuildUsed / guildQuotaLimit) * 100)) : 0;
  const totalEstimatedCost = (costSummary || []).reduce((sum, entry) => sum + (entry.total_cost || 0), 0);

  const configChecks = [
    { label: "System prompt configured", done: Boolean(config.SYSTEM_PROMPT?.trim()) },
    {
      label: "Welcome setup complete",
      done:
        config.WELCOME_ENABLED !== "1" ||
        (Boolean(config.WELCOME_CHANNEL_ID?.trim()) && Boolean(config.WELCOME_MESSAGE?.trim())),
    },
    {
      label: "Digest setup complete",
      done:
        config.DIGEST_ENABLED !== "1" ||
        (Boolean(config.DIGEST_CHANNEL_ID?.trim()) && Boolean(config.DIGEST_TIME?.trim())),
    },
    {
      label: "Moderation setup complete",
      done:
        config.MODERATION_ENABLED !== "1" ||
        (Boolean(config.MOD_LOG_CHANNEL_ID?.trim()) && Boolean(config.MODERATION_SENSITIVITY?.trim())),
    },
    {
      label: "Translation setup complete",
      done:
        config.TRANSLATE_AUTO_ENABLED !== "1" ||
        (Boolean(config.TRANSLATE_AUTO_CHANNEL_ID?.trim()) && Boolean(config.TRANSLATE_AUTO_TARGET?.trim())),
    },
  ];
  const completedChecks = configChecks.filter((item) => item.done).length;
  const configCompletenessPct = Math.round((completedChecks / configChecks.length) * 100);
  const moderationChecks = [
    { label: "Auto-moderation enabled", done: config.MODERATION_ENABLED === "1" },
    { label: "Log channel selected", done: Boolean(config.MOD_LOG_CHANNEL_ID?.trim()) },
    { label: "Sensitivity set", done: Boolean(config.MODERATION_SENSITIVITY?.trim()) },
  ];
  const moderationCompleted = moderationChecks.filter((item) => item.done).length;
  const moderationCompletenessPct = Math.round((moderationCompleted / moderationChecks.length) * 100);

  function handleAddToDiscord(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      permissions: DISCORD_BOT_PERMISSIONS,
      integration_type: "0",
      scope: DISCORD_BOT_SCOPE,
    });

    // Use callback only when an explicit, Discord-whitelisted URI is configured.
    if (DISCORD_REDIRECT_URI) {
      params.set("redirect_uri", DISCORD_REDIRECT_URI);
      params.set("response_type", "code");
    }

    window.location.assign(`${DISCORD_OAUTH_BASE_URL}?${params.toString()}`);
  }

  const primaryProvider = providersData?.providers.find((p) => p.is_primary);

  const features = [
    {
      name: "Daily Digest",
      enabled: config.DIGEST_ENABLED === "1",
      icon: Calendar,
      desc: config.DIGEST_TIME ? `Scheduled for ${config.DIGEST_TIME} PHT (UTC+8)` : "Not scheduled",
    },
    {
      name: "Auto-Moderation",
      enabled: config.MODERATION_ENABLED === "1",
      icon: ShieldCheck,
      desc: `Sensitivity: ${config.MODERATION_SENSITIVITY || "medium"}`,
    },
    {
      name: "Translation",
      enabled: config.TRANSLATE_AUTO_ENABLED === "1",
      icon: Languages,
      desc: `Target: ${config.TRANSLATE_AUTO_TARGET || "English"}`,
    },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-3">
          {botStatus?.online && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected as <span className="font-semibold text-foreground">{botStatus.username}</span>
            </div>
          )}
          <Button
            asChild
            className="h-9 rounded-full bg-[#5865F2] px-4 font-semibold text-white shadow-sm hover:bg-[#4752C4] active:bg-[#3F4AB8]"
          >
            <a
              href={`${DISCORD_OAUTH_BASE_URL}?client_id=${DISCORD_CLIENT_ID}&permissions=${DISCORD_BOT_PERMISSIONS}&integration_type=0&scope=bot+applications.commands`}
              onClick={handleAddToDiscord}
              aria-label="Add SparkSage bot to a Discord server"
            >
              Add to Discord
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            {botStatus?.online ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="flex items-center gap-2">
                <Badge
                  variant={botStatus?.online ? "default" : "secondary"}
                  className={
                    botStatus?.online
                      ? "border-green-500/40 bg-green-500/10 text-green-700"
                      : "text-muted-foreground"
                  }
                >
                  {botStatus?.online ? "Online" : "Offline"}
                </Badge>
                {botStatus?.online && (
                  <span className="text-xs text-muted-foreground">
                    Ready
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latency</CardTitle>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
              <Activity className="h-4 w-4 text-amber-500" />
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {botStatus?.latency_ms != null
                ? `${Math.round(botStatus.latency_ms)}ms`
                : "--"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Servers</CardTitle>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10">
              <Server className="h-4 w-4 text-blue-500" />
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{botStatus?.guild_count ?? "--"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Provider</CardTitle>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10">
              <Cpu className="h-4 w-4 text-violet-500" />
            </span>
          </CardHeader>
          <CardContent>
            {primaryProvider ? (
              <div>
                <p className="text-lg font-semibold truncate">{primaryProvider.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">{primaryProvider.model}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription>Common setup and management tasks.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">
              <Settings className="h-4 w-4" />
              Open Settings
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/plugins">
              <Plug className="h-4 w-4" />
              Manage Plugins
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/conversations">
              <MessagesSquare className="h-4 w-4" />
              View Conversations
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Module Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Status</CardTitle>
            <CardDescription>Quick overview of active bot modules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature) => (
              <div key={feature.name} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${feature.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.name}</p>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                </div>
                <Badge
                  variant={feature.enabled ? "outline" : "secondary"}
                  className={
                    feature.enabled
                      ? "border-green-500/40 bg-green-500/10 text-green-700"
                      : "text-muted-foreground"
                  }
                >
                  {feature.enabled ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Server List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Connected Servers
            </CardTitle>
            <CardDescription>Recent servers the bot has joined.</CardDescription>
          </CardHeader>
          <CardContent>
            {!botStatus?.guilds || botStatus.guilds.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No servers connected.</p>
            ) : (
              <div className="space-y-3">
                {botStatus?.guilds?.map((guild) => (
                  <div key={guild.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[150px]">{guild.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {guild.member_count} members
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration Completeness</CardTitle>
            <CardDescription>
              {completedChecks}/{configChecks.length} setup checks completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall readiness</span>
                <span className="font-medium">{configCompletenessPct}%</span>
              </div>
              <Progress value={configCompletenessPct} />
            </div>
            <div className="space-y-2">
              {configChecks.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <Badge variant={item.done ? "outline" : "secondary"}>
                    {item.done ? "Done" : "Missing"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moderation Setup</CardTitle>
            <CardDescription>
              {moderationCompleted}/{moderationChecks.length} moderation checks completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Moderation readiness</span>
                <span className="font-medium">{moderationCompletenessPct}%</span>
              </div>
              <Progress value={moderationCompletenessPct} />
            </div>
            <div className="space-y-2">
              {moderationChecks.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <Badge variant={item.done ? "outline" : "secondary"}>
                    {item.done ? "Done" : "Missing"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quota and Cost Snapshot</CardTitle>
            <CardDescription>Live usage pressure and current spend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Top User Quota</span>
                <span className="font-medium">{topUserUsed}/{userQuotaLimit || "--"}</span>
              </div>
              <Progress value={userQuotaPct} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Top Server Quota</span>
                <span className="font-medium">{topGuildUsed}/{guildQuotaLimit || "--"}</span>
              </div>
              <Progress value={guildQuotaPct} />
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Estimated total cost</p>
              <p className="text-lg font-semibold">${totalEstimatedCost.toFixed(4)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fallback chain */}
      {providersData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Fallback Chain</CardTitle>
            <CardDescription>Automatic routing if the primary provider fails.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {providersData.fallback_order.map((name, i) => {
                const prov = providersData.providers.find((p) => p.name === name);
                return (
                  <div key={name} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          prov?.configured ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm">{prov?.display_name || name}</span>
                      {prov?.is_primary && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {i < providersData.fallback_order.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
