"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { getApiUrl } from "../../../lib/api";

interface DailyCost {
  date: string;
  provider: string;
  total_cost: number;
}

interface MonthlyProjection {
  projected_monthly_cost: number;
  current_month_cost: number;
}

interface CostSummary {
  provider: string;
  total_cost: number;
}

export default function CostTrackingPage() {
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [monthlyProjection, setMonthlyProjection] = useState<MonthlyProjection | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const dailyCostsRes = await fetch(getApiUrl("/cost_tracking/daily_costs"));
        const dailyCostsData = await dailyCostsRes.json();
        setDailyCosts(dailyCostsData);

        const monthlyProjectionRes = await fetch(getApiUrl("/cost_tracking/monthly_projection"));
        const monthlyProjectionData = await monthlyProjectionRes.json();
        setMonthlyProjection(monthlyProjectionData);

        const costSummaryRes = await fetch(getApiUrl("/cost_tracking/summary"));
        const costSummaryData = await costSummaryRes.json();
        setCostSummary(costSummaryData);
      } catch (err) {
        setError("Failed to fetch cost data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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
      </div>

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
                {Array.isArray(costSummary) && costSummary.map((summary) => (
                  <TableRow key={summary.provider}>
                    <TableCell className="font-medium">{summary.provider}</TableCell>
                    <TableCell className="text-right">${summary.total_cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
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
                {Array.isArray(dailyCosts) && dailyCosts.map((dayCost, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{dayCost.date}</TableCell>
                    <TableCell>{dayCost.provider}</TableCell>
                    <TableCell className="text-right">${dayCost.total_cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
