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
  TrendingUp 
} from "lucide-react";
import { api, AnalyticsSummary, AnalyticsHistory } from "@/lib/api";
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

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    try {
      const [summaryData, historyData] = await Promise.all([
        api.getAnalyticsSummary(token!),
        api.getAnalyticsHistory(token!, 14),
      ]);
      setSummary(summaryData);
      setHistory(historyData);
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
    <div className="space-y-6">
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
          {/* Top Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Tokens Used</CardTitle>
                <Zap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_tokens.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Cumulative token usage</p>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Providers</CardTitle>
                <BarChart3 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.providers.length}</div>
                <p className="text-xs text-muted-foreground">Models utilized</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
                  <LineChart data={history?.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tickFormatter={(val) => {
                        try {
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
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Provider Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" /> Provider Distribution
                </CardTitle>
                <CardDescription>Usage split across models.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary?.providers}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="provider"
                    >
                      {summary?.providers.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => [`${value.toLocaleString()} requests`, name]}
                    />
                    <Legend formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)} />
                  </PieChart>
                </ResponsiveContainer>
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
function Button({ children, variant, size, onClick, className }: any) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-3 text-xs";
  const vClass = variant === "outline" ? "border border-input bg-background hover:bg-accent hover:text-accent-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90";
  
  return (
    <button className={`${base} ${vClass} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}
