"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Gauge, Users, Building2 } from "lucide-react";
import { api, type QuotaSummary } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function QuotaTable({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: QuotaSummary["users"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Allowed</TableHead>
                <TableHead className="text-right">Blocked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">{entry.id}</TableCell>
                  <TableCell className="text-right">
                    {entry.used}/{entry.limit}
                  </TableCell>
                  <TableCell className="text-right">{entry.remaining.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{entry.allowed_count}</TableCell>
                  <TableCell className="text-right">{entry.blocked_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function QuotaPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);

  const loadQuota = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getQuotaSummary(token);
      setQuota(data);
    } catch (error) {
      toast.error("Failed to load quota data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

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
        <div>
          <h1 className="text-2xl font-bold">Quota Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Live request quota utilization based on in-memory token buckets.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadQuota}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">User Limit / Min</CardTitle>
            <Gauge className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quota?.limits.user_per_minute ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Guild Limit / Min</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quota?.limits.guild_per_minute ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active User Buckets</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quota?.active.user_buckets ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Guild Buckets</CardTitle>
            <Building2 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quota?.active.guild_buckets ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuotaTable
          title="Top User Quotas"
          description="Users with the highest recent quota usage/blocking."
          entries={quota?.users ?? []}
        />
        <QuotaTable
          title="Top Guild Quotas"
          description="Guilds with the highest recent quota usage/blocking."
          entries={quota?.guilds ?? []}
        />
      </div>
    </div>
  );
}
