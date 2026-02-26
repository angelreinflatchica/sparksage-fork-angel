const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    cache: "no-store",
    ...rest,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export function getApiUrl(path: string): string {
  return `${API_URL}${path}`;
}

// Response types matching backend
export interface ProviderItem {
  name: string;
  display_name: string;
  model: string;
  free: boolean;
  configured: boolean;
  is_primary: boolean;
}

export interface ProvidersResponse {
  providers: ProviderItem[];
  fallback_order: string[];
}

export interface ChannelItem {
  channel_id: string;
  message_count: number;
  last_active: string;
}

export interface MessageItem {
  role: string;
  content: string;
  provider: string | null;
  created_at: string;
}

export interface GuildInfo {
  id: string;
  name: string;
  member_count: number;
}

export interface BotStatus {
  online: boolean;
  username: string | null;
  latency_ms: number | null;
  guild_count: number;
  guilds: GuildInfo[];
  uptime?: number | null;
}

export interface TestProviderResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export interface FAQItem {
  id: number;
  guild_id: string;
  question: string;
  answer: string;
  match_keywords: string;
  times_used: number;
  created_by: string | null;
  created_at: string;
}

export interface FAQCreate {
  guild_id: string;
  question: string;
  answer: string;
  match_keywords: string;
}

export interface PermissionItem {
  command_name: string;
  guild_id: string;
  role_id: string;
}

export interface ChannelPromptItem {
  channel_id: string;
  guild_id: string;
  system_prompt: string;
}

export interface ChannelPromptUpdate {
  channel_id: string;
  guild_id: string;
  system_prompt: string;
}

export interface ChannelProviderItem {
  channel_id: string;
  guild_id: string;
  provider: string;
}

export interface ChannelProviderUpdate {
  channel_id: string;
  guild_id: string;
  provider: string;
}

export interface AnalyticsSummary {
  total_events: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_estimated_cost: number;
  avg_latency_ms: number;
  providers_by_events: { provider: string; count: number }[];
  providers_by_cost: { provider: string; total_cost: number }[];
}

export interface AnalyticsHistory {
  daily: { 
    day: string; 
    messages: number; 
    total_events: number; 
    total_input_tokens: number;
    total_output_tokens: number;
    total_estimated_cost: number;
    avg_latency: number 
  }[];
  cost_per_provider_per_day: { day: string; provider: string; daily_cost: number }[];
  top_channels: { channel_id: string; count: number }[];
}

export interface HelpfulnessRating {
  helpfulness_rating: number;
  helpful_count: number;
  not_helpful_count: number;
  total_feedback: number;
}

export interface PluginItem {
  id: string;
  name: string;
  version: string | null;
  author: string | null;
  description: string | null;
  enabled: boolean;
}

export const api = {
  // Auth
  login: (password: string) =>
    apiFetch<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  me: (token: string) =>
    apiFetch<{ user_id: string; role: string }>("/api/auth/me", { token }),

  // Config
  getConfig: (token: string) =>
    apiFetch<{ config: Record<string, string> }>("/api/config", { token }),

  updateConfig: (token: string, values: Record<string, string>) =>
    apiFetch<{ status: string }>("/api/config", {
      method: "PUT",
      body: JSON.stringify({ values }),
      token,
    }),

  // Providers
  getProviders: (token: string) =>
    apiFetch<ProvidersResponse>("/api/providers", { token }),

  testProvider: (token: string, provider: string, apiKey?: string) =>
    apiFetch<TestProviderResult>("/api/providers/test", {
      method: "POST",
      body: JSON.stringify({ provider, api_key: apiKey }),
      token,
    }),

  setPrimaryProvider: (token: string, provider: string) =>
    apiFetch<{ status: string; primary: string }>("/api/providers/primary", {
      method: "PUT",
      body: JSON.stringify({ provider }),
      token,
    }),

  // Bot
  getBotStatus: (token: string) =>
    apiFetch<BotStatus>("/api/bot/status", { token }),

  // Conversations
  getConversations: (token: string) =>
    apiFetch<{ channels: ChannelItem[] }>("/api/conversations", { token }),

  getConversation: (token: string, channelId: string) =>
    apiFetch<{ channel_id: string; messages: MessageItem[] }>(
      `/api/conversations/${channelId}`,
      { token }
    ),

  deleteConversation: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/conversations/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Wizard
  getWizardStatus: (token: string) =>
    apiFetch<{ completed: boolean; current_step: number }>("/api/wizard/status", { token }),

  completeWizard: (token: string, data: Record<string, string>) =>
    apiFetch<{ status: string }>("/api/wizard/complete", {
      method: "POST",
      body: JSON.stringify({ config: data }),
      token,
    }),

  // FAQs
  getFAQs: (token: string) =>
    apiFetch<FAQItem[]>("/api/faqs", { token }),

  createFAQ: (token: string, data: FAQCreate) =>
    apiFetch<FAQItem>("/api/faqs", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  deleteFAQ: (token: string, id: number) =>
    apiFetch<{ status: string }>(`/api/faqs/${id}`, {
      method: "DELETE",
      token,
    }),

  // Permissions
  getPermissions: (token: string) =>
    apiFetch<PermissionItem[]>("/api/permissions", { token }),

  createPermission: (token: string, data: PermissionItem) =>
    apiFetch<PermissionItem>("/api/permissions", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  deletePermission: (token: string, command: string, guildId: string, roleId: string) =>
    apiFetch<{ status: string }>(`/api/permissions/${command}/${guildId}/${roleId}`, {
      method: "DELETE",
      token,
    }),

  // Prompts
  getChannelPrompts: (token: string) =>
    apiFetch<ChannelPromptItem[]>("/api/prompts", { token }),

  updateChannelPrompt: (token: string, data: ChannelPromptUpdate) =>
    apiFetch<{ status: string }>("/api/prompts", {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  deleteChannelPrompt: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/prompts/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Channel Providers
  getChannelProviders: (token: string) =>
    apiFetch<ChannelProviderItem[]>("/api/channel-providers", { token }),

  updateChannelProvider: (token: string, data: ChannelProviderUpdate) =>
    apiFetch<{ status: string }>("/api/channel-providers", {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  deleteChannelProvider: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/channel-providers/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Analytics
  getAnalyticsSummary: (token: string) =>
    apiFetch<AnalyticsSummary>("/api/analytics/summary", { token }),

  getAnalyticsHistory: (token: string, days: number = 7) =>
    apiFetch<AnalyticsHistory>(`/api/analytics/history?days=${days}`, { token }),

  getHelpfulnessRating: (token: string) =>
    apiFetch<HelpfulnessRating>("/api/analytics/helpfulness", { token }),

  // Plugins
  getPlugins: (token: string) =>
    apiFetch<{ plugins: PluginItem[] }>("/api/plugins", { token }),

  togglePlugin: (token: string, id: string, enabled: boolean) =>
    apiFetch<{ status: string; enabled: boolean }>("/api/plugins/toggle", {
      method: "POST",
      body: JSON.stringify({ id, enabled }),
      token,
    }),

  reloadPlugin: (token: string, id: string) =>
    apiFetch<{ status: string }>(`/api/plugins/${id}/reload`, {
      method: "POST",
      token,
    }),

  syncPlugins: (token: string) =>
    apiFetch<{ status: string }>("/api/plugins/sync", {
      method: "POST",
      token,
    }),
};
