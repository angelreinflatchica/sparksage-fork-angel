"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSession } from "next-auth/react";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Loader2, RefreshCw, Puzzle, User, AlertCircle, Upload, Trash2 
} from "lucide-react";
import { api, type PluginItem } from "@/lib/api";

export default function PluginsPage() {
  const { data: session } = useSession();
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const token = (session as { accessToken?: string })?.accessToken;

  const fetchPlugins = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getPlugins(token);
      setPlugins(data.plugins);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load plugins";
      if (message.toLowerCase().includes("bot is not running")) {
        toast.message("Plugins loaded in offline mode. Start the bot to enable or reload plugins.");
      } else {
        toast.error("Could not load plugins");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPlugins();
    }
  }, [token, fetchPlugins]);

  const togglePlugin = async (id: string, currentStatus: boolean) => {
    if (!token) return;
    setActionLoading(id);
    try {
      await api.togglePlugin(token, id, !currentStatus);

      setPlugins(plugins.map(p => 
        p.id === id ? { ...p, enabled: !currentStatus } : p
      ));
      
      toast.success(`Plugin ${!currentStatus ? "enabled" : "disabled"} successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update plugin";
      toast.error(message);
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  const reloadPlugin = async (id: string) => {
    if (!token) return;
    setActionLoading(`reload-${id}`);
    try {
      await api.reloadPlugin(token, id);
      toast.success("Plugin reloaded successfully");
    } catch (error) {
      toast.error("Failed to reload plugin");
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  const syncAll = async () => {
    if (!token) return;
    setActionLoading("sync-all");
    try {
      await api.syncPlugins(token);
      toast.success("Global commands synced successfully. Discord may take a few moments to update.");
    } catch (error) {
      toast.error("Failed to sync commands");
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const uploadPlugin = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";

    if (!selected) return;
    if (!token) {
      toast.error("Please sign in again to upload plugins");
      return;
    }

    if (!selected.name.toLowerCase().endsWith(".zip")) {
      toast.error("Only .zip plugin archives are supported");
      return;
    }

    setActionLoading("upload-plugin");
    try {
      const result = await api.uploadPlugin(token, selected);
      toast.success(result.message);
      await fetchPlugins();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload plugin";
      if (message.toLowerCase().includes("bot is not running")) {
        toast.message("Plugin uploaded. Start the bot to enable or run plugins.");
        await fetchPlugins();
      } else {
        toast.error(message);
        console.error(error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const removePlugin = async (id: string, name: string) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete plugin \"${name}\"? This will remove its files from the server.`);
    if (!confirmed) return;

    setActionLoading(`delete-${id}`);
    try {
      await api.deletePlugin(token, id);
      toast.success("Plugin removed successfully");
      await fetchPlugins();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove plugin";
      toast.error(message);
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Plugins</h2>
          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={uploadPlugin}
            />
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={handleUploadClick}
              disabled={actionLoading === "upload-plugin"}
            >
              {actionLoading === "upload-plugin" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Install Plugin
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={syncAll}
              disabled={actionLoading === "sync-all"}
            >
              <RefreshCw className={`h-4 w-4 ${actionLoading === "sync-all" ? "animate-spin" : ""}`} />
              Sync Commands
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Manage community-contributed extensions and features.
        </p>
      </div>

      {plugins.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <Puzzle className="mb-4 h-12 w-12 text-muted-foreground opacity-20" />
          <CardTitle>No plugins found</CardTitle>
          <CardDescription className="mt-2 max-w-[400px]">
            Install plugin <code>.zip</code> archives or place them in the <code>plugins/</code> directory with a <code>manifest.json</code>.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <Card key={plugin.id} className={plugin.enabled ? "border-primary/50" : "opacity-80"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plugin.name}</CardTitle>
                  <Badge variant={plugin.enabled ? "default" : "secondary"}>
                    {plugin.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <User className="h-3 w-3" /> {plugin.author || "Unknown"}
                  <span className="text-muted-foreground/30">•</span>
                  <span>v{plugin.version || "1.0.0"}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-[80px] pb-3">
                <p className="text-sm text-muted-foreground">
                  {plugin.description || "No description provided for this plugin."}
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t bg-muted/50 px-6 py-3">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={plugin.enabled} 
                    onCheckedChange={() => togglePlugin(plugin.id, plugin.enabled)}
                    disabled={actionLoading === plugin.id}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {actionLoading === plugin.id ? "Working..." : "Active"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {plugin.enabled && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="Reload Code"
                      onClick={() => reloadPlugin(plugin.id)}
                      disabled={actionLoading === `reload-${plugin.id}` || actionLoading === `delete-${plugin.id}`}
                    >
                      <RefreshCw className={`h-4 w-4 ${actionLoading === `reload-${plugin.id}` ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete Plugin"
                    onClick={() => removePlugin(plugin.id, plugin.name)}
                    disabled={actionLoading === `delete-${plugin.id}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {actionLoading === `delete-${plugin.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            Developer Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Plugin archives must contain a single top-level plugin folder with a valid <code>manifest.json</code> and a valid <code>cog</code> path.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
