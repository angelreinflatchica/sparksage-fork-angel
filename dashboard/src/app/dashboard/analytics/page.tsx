"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { 
  Loader2, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Activity, 
  Zap, 
  Clock, 
  TrendingUp,
  Smile
} from "lucide-react";
import { api, AnalyticsSummary, AnalyticsHistory, HelpfulnessRating } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [history, setHistory] = useState<AnalyticsHistory | null>(null);
  const [helpfulness, setHelpfulness] = useState<HelpfulnessRating | null>(null);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    try {
      const [summaryData, historyData, helpfulnessData] = await Promise.all([
        api.getAnalyticsSummary(token!),
        api.getAnalyticsHistory(token!, 14),
        api.getHelpfulnessRating(token!),
      ]);
      setSummary(summaryData);
      setHistory(historyData);
      setHelpfulness(helpfulnessData);
    } catch (err) {
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = summary && summary.total_events > 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          Refresh Data
        </Button>
      </div>

      {!hasData ? (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <CardTitle>No Analytics Data</CardTitle>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              Bot activity hasn't been recorded yet. Interact with the bot in Discord 
              (mention it or use commands) to start seeing usage statistics here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_events.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total bot interactions</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Input Tokens</CardTitle>
                <Zap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_input_tokens.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Cumulative tokens sent to AI</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Output Tokens</CardTitle>
                <Zap className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_output_tokens.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Cumulative tokens received from AI</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Est. Cost</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary?.total_estimated_cost.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Cumulative estimated AI cost</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.avg_latency_ms}ms</div>
                <p className="text-xs text-muted-foreground">Average response time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">AI Helpfulness</CardTitle>
                <Smile className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{helpfulness?.helpfulness_rating ?? 0}%</div>
                <p className="text-xs text-muted-foreground">{helpfulness?.total_feedback || 0} responses rated</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Daily Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Messages Per Day
                </CardTitle>
                <CardDescription>Daily request count over the last 14 days.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history?.daily} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tickFormatter={(val) => {
                        try {
                          // eslint-disable-next-line react/no-unescaped-entities
                          return new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                        } catch {
                          return val;
                        }
                      }}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="messages" 
                      name="Messages"
                      stroke="hsl(var(--primary))" 
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      isAnimationActive={false}
                      dot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "white" }}
                      activeDot={{ r: 8, fill: "hsl(var(--primary))" }}
                      fill="url(#colorMessages)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Daily Cost Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Daily Estimated Cost
                </CardTitle>
                <CardDescription>Estimated cost per day over the last 14 days.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history?.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tickFormatter={(val) => {
                        try {
                          // eslint-disable-next-line react/no-unescaped-entities
                          return new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                        } catch {
                          return val;
                        }
                      }}
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={(val) => `$${val.toFixed(2)}`}
                      fontSize={12} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number | undefined) => value !== undefined ? `$${value.toFixed(4)}` : 'N/A'}
                    />
                    <Bar 
                      dataKey="total_estimated_cost" 
                      name="Estimated Cost" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Provider Cost Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" /> Provider Cost Distribution
                </CardTitle>
                <CardDescription>Cost split across models.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary?.providers_by_cost.filter(p => p.total_cost > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="total_cost"
                      nameKey="provider"
                    >
                      {summary?.providers_by_cost.filter(p => p.total_cost > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number | undefined, name: string | undefined) => {
                        const formattedValue = value !== undefined ? `$${value.toFixed(4)}` : 'N/A';
                        const formattedName = name !== undefined ? name : 'N/A';
                        return [formattedValue, formattedName];
                      }}
                    />
                    <Legend formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Projected Monthly Cost */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Projected Monthly Cost
                </CardTitle>
                <CardDescription>Estimated cost for the current month.</CardDescription>
              </CardHeader>
              <CardContent className="h-[100px] pt-4 flex items-center justify-center">
                <p className="text-4xl font-bold">
                  ${(summary?.total_estimated_cost && summary.total_events > 0) 
                    ? ((summary.total_estimated_cost / summary.total_events) * 30 * (summary.total_events / (history?.daily.length || 1))).toFixed(2)
                    : "0.00"
                  }
                </p>
              </CardContent>
            </Card>

            {/* Top Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Channels</CardTitle>
                <CardDescription>Most active Discord channels.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history?.top_channels}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="channel_id" fontSize={10} hide />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(val) => `Channel: ${val}`}
                    />
                    <Bar dataKey="count" name="Count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1">
            {/* Latency History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latency Trend</CardTitle>
                <CardDescription>Avg response time (ms) per day.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history?.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tickFormatter={(val) => {
                        try {
                          // eslint-disable-next-line react/no-unescaped-entities
                          return new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                        } catch {
                          return val;
                        }
                      }}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avg_latency" 
                      name="Latency (ms)"
                      stroke="#FFBB28" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Button component
interface AnalyticsButtonProps {
  children: React.ReactNode;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

function Button({ children, variant, size, onClick, className }: AnalyticsButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-3 text-xs";
  const vClass = variant === "outline" ? "border border-input bg-background hover:bg-accent hover:text-accent-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90";
  
  return (
    <button className={`${base} ${vClass} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}
