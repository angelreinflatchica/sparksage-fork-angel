"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, RotateCcw, Languages, Hash, Power, PowerOff, Info, Globe, Plus, Trash2, Cpu, CheckCircle2, AlertCircle, MessageSquare, ShieldAlert, Sliders, Calendar, Clock } from "lucide-react";
import { api, ChannelProviderItem, ProviderItem, ChannelPromptItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const settingsSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "Discord token is required"),
  BOT_PREFIX: z.string().min(1).max(5),
  MAX_TOKENS: z.number().min(128).max(4096),
  SYSTEM_PROMPT: z.string().min(1),
  GEMINI_API_KEY: z.string(),
  GROQ_API_KEY: z.string(),
  OPENROUTER_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  RATE_LIMIT_USER: z.number().min(1).max(60),
  RATE_LIMIT_GUILD: z.number().min(1).max(500),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const DEFAULTS: SettingsForm = {
  DISCORD_TOKEN: "",
  BOT_PREFIX: "!",
  MAX_TOKENS: 1024,
  SYSTEM_PROMPT:
    "You are SparkSage, a helpful and friendly AI assistant in a Discord server. Be concise, helpful, and engaging.",
  GEMINI_API_KEY: "",
  GROQ_API_KEY: "",
  OPENROUTER_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
  RATE_LIMIT_USER: 5,
  RATE_LIMIT_GUILD: 20,
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Translation states
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [translateChannelId, setTranslateChannelId] = useState("");
  const [translateTargetLang, setTranslateTargetLang] = useState("English");
  // Moderation states
  const [modEnabled, setModEnabled] = useState(false);
  const [modChannelId, setModChannelId] = useState("");
  const [modSensitivity, setModSensitivity] = useState("medium");
  // Daily Digest states
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestChannelId, setDigestChannelId] = useState("");
  const [digestTime, setDigestTime] = useState("09:00");
  // Channel Providers states
  const [channelProviderMappings, setChannelProviderMappings] = useState<ChannelProviderItem[]>([]);
  const [channelProviderAvailableProviders, setChannelProviderAvailableProviders] = useState<ProviderItem[]>([]);
  const [newChannelProviderChannelId, setNewChannelProviderChannelId] = useState("");
  const [newChannelProviderGuildId, setNewChannelProviderGuildId] = useState("");
  const [newChannelProviderProvider, setNewChannelProviderProvider] = useState("");
  // Prompts states
  const [channelPromptPrompts, setChannelPromptPrompts] = useState<ChannelPromptItem[]>([]);
  const [newChannelPromptChannelId, setNewChannelPromptChannelId] = useState("");
  const [newChannelPromptGuildId, setNewChannelPromptGuildId] = useState("");
  const [newChannelPromptPrompt, setNewChannelPromptPrompt] = useState("");

  const token = (session as { accessToken?: string })?.accessToken;

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!token) return;
    api
      .getConfig(token)
      .then(({ config }) => {
        const mapped: Partial<SettingsForm> = {};
        for (const key of Object.keys(DEFAULTS) as (keyof SettingsForm)[]) {
          if (config[key] !== undefined) {
            if (key === "MAX_TOKENS" || key === "RATE_LIMIT_USER" || key === "RATE_LIMIT_GUILD") {
              mapped[key] = Number(config[key]);
            } else {
              (mapped as Record<string, string>)[key] = config[key];
            }
          }
        }
        setTranslateEnabled(config.TRANSLATE_AUTO_ENABLED === "1");
        setTranslateChannelId(config.TRANSLATE_AUTO_CHANNEL_ID || "");
        setTranslateTargetLang(config.TRANSLATE_AUTO_TARGET || "English");
        // Load Moderation settings
        setModEnabled(config.MODERATION_ENABLED === "1");
        setModChannelId(config.MOD_LOG_CHANNEL_ID || "");
        setModSensitivity(config.MODERATION_SENSITIVITY || "medium");
        // Load Daily Digest settings
        setDigestEnabled(config.DIGEST_ENABLED === "1");
        setDigestChannelId(config.DIGEST_CHANNEL_ID || "");
        setDigestTime(config.DIGEST_TIME || "09:00");
        form.reset({ ...DEFAULTS, ...mapped });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    async function loadChannelProvidersData() {
      try {
        const [providersData, mappingsData] = await Promise.all([
          api.getProviders(token!),
          api.getChannelProviders(token!),
        ]);
        setChannelProviderAvailableProviders(providersData.providers);
        setChannelProviderMappings(mappingsData);
      } catch (err) {
        toast.error("Failed to load channel provider configuration");
      }
    }
    loadChannelProvidersData();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    async function loadChannelPromptPrompts() {
      try {
        const data = await api.getChannelPrompts(token!);
        setChannelPromptPrompts(data);
      } catch (err) {
        toast.error("Failed to load channel prompts");
      }
    }
    loadChannelPromptPrompts();
  }, [token]);

  async function onSubmit(values: SettingsForm) {
    if (!token) return;
    setSaving(true);
    try {
      // Convert to string values for the API, skip masked values (***...)
      const payload: Record<string, string> = {};
      for (const [key, val] of Object.entries(values)) {
        const strVal = String(val);
        if (!strVal.startsWith("***")) {
          payload[key] = strVal;
        }
      }
      payload.TRANSLATE_AUTO_ENABLED = translateEnabled ? "1" : "0";
      payload.TRANSLATE_AUTO_CHANNEL_ID = translateChannelId;
      payload.TRANSLATE_AUTO_TARGET = translateTargetLang;
      // Save Moderation settings
      payload.MODERATION_ENABLED = modEnabled ? "1" : "0";
      payload.MOD_LOG_CHANNEL_ID = modChannelId;
      payload.MODERATION_SENSITIVITY = modSensitivity;
      // Save Daily Digest settings
      payload.DIGEST_ENABLED = digestEnabled ? "1" : "0";
      payload.DIGEST_CHANNEL_ID = digestChannelId;
      payload.DIGEST_TIME = digestTime;
      await api.updateConfig(token, payload);
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    form.reset(DEFAULTS);
  }

  async function handleAddChannelProvider() {
    if (!token || !newChannelProviderChannelId || !newChannelProviderGuildId || !newChannelProviderProvider) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await api.updateChannelProvider(token, {
        channel_id: newChannelProviderChannelId,
        guild_id: newChannelProviderGuildId,
        provider: newChannelProviderProvider,
      });
      toast.success("Channel provider updated");
      setNewChannelProviderChannelId("");
      setNewChannelProviderGuildId("");
      setNewChannelProviderProvider("");
      // Reload mappings after update
      const [providersData, mappingsData] = await Promise.all([
        api.getProviders(token!),
        api.getChannelProviders(token!),
      ]);
      setChannelProviderAvailableProviders(providersData.providers);
      setChannelProviderMappings(mappingsData);
    } catch (err) {
      toast.error("Failed to update channel provider");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteChannelProvider(channelId: string) {
    if (!token) return;
    try {
      await api.deleteChannelProvider(token, channelId);
      toast.success("Channel mapping removed");
      // Reload mappings after delete
      const [providersData, mappingsData] = await Promise.all([
        api.getProviders(token!),
        api.getChannelProviders(token!),
      ]);
      setChannelProviderAvailableProviders(providersData.providers);
      setChannelProviderMappings(mappingsData);
    } catch (err) {
      toast.error("Failed to remove mapping");
    }
  }

  async function handleAddChannelPrompt() {
    if (!token || !newChannelPromptChannelId || !newChannelPromptGuildId || !newChannelPromptPrompt) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await api.updateChannelPrompt(token, {
        channel_id: newChannelPromptChannelId,
        guild_id: newChannelPromptGuildId,
        system_prompt: newChannelPromptPrompt,
      });
      toast.success("Channel prompt updated");
      setNewChannelPromptChannelId("");
      setNewChannelPromptGuildId("");
      setNewChannelPromptPrompt("");
      // Reload prompts after update
      const data = await api.getChannelPrompts(token!);
      setChannelPromptPrompts(data);
    } catch (err) {
      toast.error("Failed to update prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteChannelPrompt(channelId: string) {
    if (!token) return;
    try {
      await api.deleteChannelPrompt(token, channelId);
      toast.success("Prompt removed");
      // Reload prompts after delete
      const data = await api.getChannelPrompts(token!);
      setChannelPromptPrompts(data);
    } catch (err) {
      toast.error("Failed to remove prompt");
    }
  }

  const maxTokens = form.watch("MAX_TOKENS");
  const systemPrompt = form.watch("SYSTEM_PROMPT");

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
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reset to Defaults
          </Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="translation">Translation</TabsTrigger>
            <TabsTrigger value="channel-providers">Channel Providers</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
            <TabsTrigger value="digest">Daily Digest</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Discord */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Discord</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="discord-token">Bot Token</Label>
                  <Input
                    id="discord-token"
                    type="password"
                    {...form.register("DISCORD_TOKEN")}
                  />
                  {form.formState.errors.DISCORD_TOKEN && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.DISCORD_TOKEN.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bot Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bot Behavior</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Command Prefix</Label>
                  <Input
                    id="prefix"
                    {...form.register("BOT_PREFIX")}
                    className="w-24"
                  />
                  {form.formState.errors.BOT_PREFIX && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.BOT_PREFIX.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Max Tokens</Label>
                    <span className="text-sm font-mono tabular-nums text-muted-foreground">
                      {maxTokens}
                    </span>
                  </div>
                  <Slider
                    value={[maxTokens]}
                  onValueChange={([val]) => form.setValue("MAX_TOKENS", val)}
                  min={128}
                  max={4096}
                  step={64}
                />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="system-prompt">System Prompt</Label>
                    <span className="text-xs text-muted-foreground">
                      {systemPrompt?.length || 0} characters
                    </span>
                  </div>
                  <Textarea
                    id="system-prompt"
                    {...form.register("SYSTEM_PROMPT")}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usage Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>User Rate Limit</Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        {form.watch("RATE_LIMIT_USER")} req/min
                      </span>
                    </div>
                    <Slider
                      value={[form.watch("RATE_LIMIT_USER")]}
                      onValueChange={([val]) => form.setValue("RATE_LIMIT_USER", val)}
                      min={1}
                      max={60}
                      step={1}
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Max requests per user per minute.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Server Rate Limit</Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        {form.watch("RATE_LIMIT_GUILD")} req/min
                      </span>
                    </div>
                    <Slider
                      value={[form.watch("RATE_LIMIT_GUILD")]}
                      onValueChange={([val]) => form.setValue("RATE_LIMIT_GUILD", val)}
                      min={1}
                      max={500}
                      step={5}
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Total requests per Discord server per minute.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">API Keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Masked values (***...) are not overwritten on save. Enter a new value to update.
                </p>
                {(
                  [
                    ["GEMINI_API_KEY", "Gemini"],
                    ["GROQ_API_KEY", "Groq"],
                    ["OPENROUTER_API_KEY", "OpenRouter"],
                    ["ANTHROPIC_API_KEY", "Anthropic"],
                    ["OPENAI_API_KEY", "OpenAI"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="password"
                      {...form.register(key)}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </CardContent>
                                                </Card>
                                                      <Button type="submit" disabled={saving} className="w-full">
                                                        {saving ? (
                                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                          <Save className="mr-2 h-4 w-4" />
                                                        )}
                                                        Save Settings
                                                      </Button>
                                                        </TabsContent>
                                              
                                                        <TabsContent value="translation" className="space-y-6">            {/* Translation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Translation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-Translation</Label>
                    <p className="text-xs text-muted-foreground">
                      Status: {translateEnabled ? "Active" : "Disabled"}
                    </p>
                  </div>
                  <Button 
                    variant={translateEnabled ? "default" : "outline"}
                    onClick={() => setTranslateEnabled(!translateEnabled)}
                    className="w-32"
                  >
                    {translateEnabled ? (
                      <><Power className="mr-2 h-4 w-4" /> Enabled</>
                    ) : (
                      <><PowerOff className="mr-2 h-4 w-4" /> Disabled</>
                    )}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target-lang" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Target Language
                    </Label>
                    <Input
                      id="target-lang"
                      placeholder="e.g. English, Spanish, Japanese"
                      value={translateTargetLang}
                      onChange={(e) => setTranslateTargetLang(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel" className="flex items-center gap-2">
                      <Hash className="h-4 w-4" /> Auto-Translate Channel ID
                    </Label>
                    <Input
                      id="channel"
                      placeholder="e.g. 123456789012345678"
                      value={translateChannelId}
                      onChange={(e) => setTranslateChannelId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <div className="text-muted-foreground space-y-1">
                    <p>
                      SparkSage can automatically translate messages in a specific channel. 
                      It detects the language of incoming messages and translates them to your 
                      target language if they don't already match.
                    </p>
                    <p>
                      <strong>Tip:</strong> Users can also use the <code>/translate</code> command 
                      anywhere to translate specific snippets of text manually.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channel-providers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel to Provider Mapping</CardTitle>
                <CardDescription>
                  Configure specific AI providers for individual Discord channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel ID</TableHead>
                      <TableHead>Guild ID</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelProviderMappings.map((mapping, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">
                          {mapping.channel_id}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {mapping.guild_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{mapping.provider}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteChannelProvider(mapping.channel_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {channelProviderMappings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No channel provider mappings configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <Separator />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-channel-provider-channel-id">Channel ID</Label>
                    <Input
                      id="new-channel-provider-channel-id"
                      placeholder="e.g., 123456789012345678"
                      value={newChannelProviderChannelId}
                      onChange={(e) => setNewChannelProviderChannelId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-channel-provider-guild-id">Guild ID</Label>
                    <Input
                      id="new-channel-provider-guild-id"
                      placeholder="e.g., 987654321098765432"
                      value={newChannelProviderGuildId}
                      onChange={(e) => setNewChannelProviderGuildId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-channel-provider-provider">Provider</Label>
                    <Input
                      id="new-channel-provider-provider"
                      placeholder="e.g., openai"
                      list="available-providers"
                      value={newChannelProviderProvider}
                      onChange={(e) => setNewChannelProviderProvider(e.target.value)}
                    />
                    <datalist id="available-providers">
                      {channelProviderAvailableProviders.map((provider) => (
                        <option key={provider.name} value={provider.name}>
                          {provider.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
                <Button onClick={handleAddChannelProvider} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add/Update Channel Provider
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="text-muted-foreground space-y-1">
                <p>
                  This feature allows you to map a specific AI provider to a Discord channel.
                  Messages in that channel will be processed by the assigned provider.
                </p>
                <p>
                  <strong>Note:</strong> Ensure the provider ID is accurate (e.g., `openai`, `gemini`, `groq`).
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel Specific Prompts</CardTitle>
                <CardDescription>
                  Define custom system prompts for individual Discord channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel ID</TableHead>
                      <TableHead>Guild ID</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelPromptPrompts.map((prompt, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">
                          {prompt.channel_id}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {prompt.guild_id}
                        </TableCell>
                        <TableCell>
                          {prompt.system_prompt.substring(0, 50)}...
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteChannelPrompt(prompt.channel_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {channelPromptPrompts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No channel specific prompts configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-channel-prompt-channel-id">Channel ID</Label>
                    <Input
                      id="new-channel-prompt-channel-id"
                      placeholder="e.g., 123456789012345678"
                      value={newChannelPromptChannelId}
                      onChange={(e) => setNewChannelPromptChannelId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-channel-prompt-guild-id">Guild ID</Label>
                    <Input
                      id="new-channel-prompt-guild-id"
                      placeholder="e.g., 987654321098765432"
                      value={newChannelPromptGuildId}
                      onChange={(e) => setNewChannelPromptGuildId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-channel-prompt-prompt">System Prompt</Label>
                  <Textarea
                    id="new-channel-prompt-prompt"
                    placeholder="e.g., You are a helpful assistant for this gaming channel."
                    value={newChannelPromptPrompt}
                    onChange={(e) => setNewChannelPromptPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button onClick={handleAddChannelPrompt} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add/Update Channel Prompt
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="text-muted-foreground space-y-1">
                <p>
                  You can override the global system prompt for specific channels. This allows
                  the bot to adopt different personas or behaviors in different contexts.
                </p>
                <p>
                  <strong>Note:</strong> Channel-specific prompts take precedence over the global
                  system prompt.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="moderation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  AI Sentinel
                </CardTitle>
                <CardDescription>
                  Analyze messages for toxicity, spam, and rule violations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Auto-Moderation</Label>
                    <p className="text-xs text-muted-foreground">
                      Status: {modEnabled ? "Scanning Messages" : "Inactive"}
                    </p>
                  </div>
                  <Button
                    variant={modEnabled ? "default" : "outline"}
                    onClick={() => setModEnabled(!modEnabled)}
                    className="w-32"
                  >
                    {modEnabled ? (
                      <><Power className="mr-2 h-4 w-4" /> Enabled</>
                    ) : (
                      <><PowerOff className="mr-2 h-4 w-4" /> Disabled</>
                    )}
                  </Button>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="channel" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" /> Mod Log Channel ID
                  </Label>
                  <Input
                    id="channel"
                    placeholder="e.g. 123456789012345678"
                    value={modChannelId}
                    onChange={(e) => setModChannelId(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Sliders className="h-4 w-4" /> Moderation Sensitivity
                  </Label>
                  <RadioGroup value={modSensitivity} onValueChange={setModSensitivity} className="grid grid-cols-3 gap-4">
                    <div>
                      <RadioGroupItem value="low" id="low" className="peer sr-only" />
                      <Label
                        htmlFor="low"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span className="text-sm font-semibold">Low</span>
                        <span className="text-[10px] text-muted-foreground text-center">Severe only</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="medium" id="medium" className="peer sr-only" />
                      <Label
                        htmlFor="medium"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span className="text-sm font-semibold">Medium</span>
                        <span className="text-[10px] text-muted-foreground text-center">Balanced</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="high" id="high" className="peer sr-only" />
                      <Label
                        htmlFor="high"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span className="text-sm font-semibold">High</span>
                        <span className="text-[10px] text-muted-foreground text-center">Strict</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <div className="text-muted-foreground space-y-1">
                    <p>
                      SparkSage uses AI to analyze message intent. Flagged content is never 
                      automatically deleted—it is sent to the moderation log with action buttons 
                      (Delete, Warn, Dismiss) for human review.
                    </p>
                    <p>
                      <strong>Low:</strong> Only flags extreme toxicity or obvious spam.<br/>
                      <strong>Medium:</strong> Flags general toxicity, insults, and repetitive spam.<br/>
                      <strong>High:</strong> Flags even minor instances of negativity or borderline spam.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="digest" className="space-y-6">
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
                      Status: {digestEnabled ? "Active" : "Disabled"}
                    </p>
                  </div>
                  <Button
                    variant={digestEnabled ? "default" : "outline"}
                    onClick={() => setDigestEnabled(!digestEnabled)}
                    className="w-32"
                  >
                    {digestEnabled ? (
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
                      value={digestTime}
                      onChange={(e) => setDigestTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel" className="flex items-center gap-2">
                      <Hash className="h-4 w-4" /> Digest Channel ID
                    </Label>
                    <Input
                      id="channel"
                      placeholder="e.g. 123456789012345678"
                      value={digestChannelId}
                      onChange={(e) => setDigestChannelId(e.target.value)}
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
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}