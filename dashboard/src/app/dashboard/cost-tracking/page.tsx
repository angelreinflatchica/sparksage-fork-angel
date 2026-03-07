"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { api, CostDailyEntry, CostMonthlyProjection, CostProviderSummary } from "../../../lib/api";

export default function CostTrackingPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [dailyCosts, setDailyCosts] = useState<CostDailyEntry[]>([]);
  const [monthlyProjection, setMonthlyProjection] = useState<CostMonthlyProjection | null>(null);
  const [costSummary, setCostSummary] = useState<CostProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllDailyCosts, setShowAllDailyCosts] = useState(false);

  const visibleDailyCosts = showAllDailyCosts ? dailyCosts : dailyCosts.slice(0, 5);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      try {
        setError(null);
        const [dailyCostsData, monthlyProjectionData, costSummaryData] = await Promise.all([
          api.getDailyCosts(token!),
          api.getMonthlyCostProjection(token!),
          api.getCostSummary(token!),
        ]);

        setDailyCosts(Array.isArray(dailyCostsData) ? dailyCostsData : []);
        setMonthlyProjection(monthlyProjectionData);
        setCostSummary(Array.isArray(costSummaryData) ? costSummaryData : []);
      } catch (err) {
        setError("Failed to fetch cost data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  if (loading) {
    return <div className="p-4">Loading cost data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Cost Tracking</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Month Cost</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(monthlyProjection?.current_month_cost ?? 0).toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              Total cost incurred this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Monthly Cost</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(monthlyProjection?.projected_monthly_cost ?? 0).toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              Estimated cost by end of month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alert Threshold</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(monthlyProjection?.alert_threshold ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Warning at ${(monthlyProjection?.warning_threshold ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {monthlyProjection?.alerts?.length ? (
        <Card className={monthlyProjection.alert_level === "critical" ? "border-red-500" : "border-amber-500"}>
          <CardHeader>
            <CardTitle className="text-base">
              {monthlyProjection.alert_level === "critical" ? "Cost Alert: Threshold Reached" : "Cost Alert: Approaching Threshold"}
            </CardTitle>
            <CardDescription>
              {monthlyProjection.alerts[0]?.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Cost Summary by Provider</CardTitle>
            <CardDescription>Total estimated costs for each AI provider.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(costSummary) && costSummary.length > 0 ? (
                  costSummary.map((summary) => (
                    <TableRow key={summary.provider}>
                      <TableCell className="font-medium">{summary.provider}</TableCell>
                      <TableCell className="text-right">${summary.total_cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No provider usage data yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Daily Cost Breakdown</CardTitle>
            <CardDescription>Daily estimated costs per provider.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(dailyCosts) && dailyCosts.length > 0 ? (
                  visibleDailyCosts.map((dayCost, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{dayCost.date}</TableCell>
                      <TableCell>{dayCost.provider}</TableCell>
                      <TableCell className="text-right">${dayCost.total_cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No daily cost entries yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {dailyCosts.length > 5 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setShowAllDailyCosts((prev) => !prev)}
                >
                  {showAllDailyCosts ? "Show less" : `Show more (${dailyCosts.length - 5} more)`}
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
