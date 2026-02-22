"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Activity, Cpu, Wifi, WifiOff, Server, ArrowRight, ShieldCheck, Calendar, Languages, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { BotStatus, ProvidersResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      api.getBotStatus(token),
      api.getProviders(token),
      api.getConfig(token),
    ]).then(([botResult, provResult, configResult]) => {
      if (botResult.status === "fulfilled") setBotStatus(botResult.value);
      if (provResult.status === "fulfilled") setProvidersData(provResult.value);
      if (configResult.status === "fulfilled") setConfig(configResult.value.config);
      setLoading(false);
    });
  }, [token]);

  const primaryProvider = providersData?.providers.find((p) => p.is_primary);

  const features = [
    {
      name: "Daily Digest",
      enabled: config.DIGEST_ENABLED === "1",
      icon: Calendar,
      desc: config.DIGEST_TIME ? `Scheduled for ${config.DIGEST_TIME}` : "Not scheduled",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        {botStatus?.online && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Connected as <span className="font-semibold text-foreground">{botStatus.username}</span>
          </div>
        )}
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
                <Badge variant={botStatus?.online ? "default" : "secondary"}>
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
            <Activity className="h-4 w-4 text-muted-foreground" />
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
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{botStatus?.guild_count ?? "--"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Provider</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
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
                <Badge variant={feature.enabled ? "outline" : "secondary"}>
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
