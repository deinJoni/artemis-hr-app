import React from "react";
import { Calendar, Download, Users, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, startOfYear, endOfYear } from "date-fns";
import type { LeaveSummaryResponse, LeaveTrendsResponse } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type LeaveReportsDashboardProps = {
  className?: string;
};

export function LeaveReportsDashboard({ className }: LeaveReportsDashboardProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [summary, setSummary] = React.useState<LeaveSummaryResponse | null>(null);
  const [trends, setTrends] = React.useState<LeaveTrendsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [startDate, setStartDate] = React.useState(
    format(startOfYear(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = React.useState(
    format(endOfYear(new Date()), "yyyy-MM-dd")
  );
  const [granularity, setGranularity] = React.useState<"month" | "quarter" | "year">("month");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = session?.access_token;
      
      // Load summary
      const summaryRes = await fetch(
        `${apiBaseUrl}/api/leave/analytics/summary?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const summaryData = await summaryRes.json();
      if (summaryRes.ok) {
        setSummary(summaryData);
      } else {
        console.error("Summary API error:", summaryRes.status, summaryData);
      }

      // Load trends
      const trendsRes = await fetch(
        `${apiBaseUrl}/api/leave/analytics/trends?start_date=${startDate}&end_date=${endDate}&granularity=${granularity}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const trendsData = await trendsRes.json();
      if (trendsRes.ok) {
        setTrends(trendsData);
      } else {
        console.error("Trends API error:", trendsRes.status, trendsData);
      }

      if (!summaryRes.ok || !trendsRes.ok) {
        const errorMsg = summaryData?.error || trendsData?.error || "Failed to load analytics data";
        setError(errorMsg);
      }
    } catch (err) {
      setError("Failed to load analytics data");
      console.error("Error loading analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, endDate, granularity, session, startDate]);

  // Load data on mount and when filters change
  React.useEffect(() => {
    if (!session) return;
    loadData();
  }, [session, loadData]);

  const handleExport = async (format: "csv" | "pdf" = "csv") => {
    if (!session) return;

    try {
      const token = session.access_token;
      const url = `${apiBaseUrl}/api/leave/analytics/export?format=${format}&start_date=${startDate}&end_date=${endDate}&report_type=utilization`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `leave-analytics-${startDate}-${endDate}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      } else {
        setError("Failed to export report");
      }
    } catch (err) {
      setError("Failed to export report");
      console.error("Error exporting:", err);
    }
  };

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!trends?.trends) return [];

    const groupedByMonth = new Map<string, Record<string, number>>();
    
    trends.trends.forEach((item: any) => {
      const monthKey = item.month || item.period;
      if (!groupedByMonth.has(monthKey)) {
        groupedByMonth.set(monthKey, { month: monthKey, total: 0 });
      }
      const group = groupedByMonth.get(monthKey)!;
      group.total += parseFloat(item.total_days) || 0;
    });

    return Array.from(groupedByMonth.values()).sort((a, b) => 
      String(a.month).localeCompare(String(b.month))
    );
  }, [trends]);

  const chartConfig = {
    total: {
      label: "Total Days",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className={className}>
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="granularity">Granularity</Label>
              <Select
                value={granularity}
                onValueChange={(value) => {
                  if (value === "month" || value === "quarter" || value === "year") {
                    setGranularity(value);
                  }
                }}
                disabled={!session}
              >
                <SelectTrigger id="granularity">
                  <SelectValue placeholder="Select granularity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <Button onClick={() => handleExport("csv")} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive p-4 bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Days Taken</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.total_days_taken.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per Employee</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.average_per_employee.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.pending_requests}</div>
              <p className="text-xs text-muted-foreground">requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.total_employees}</div>
              <p className="text-xs text-muted-foreground">employees</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
            <CardDescription>Leave days taken over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : chartData.length > 0 ? (
              <ChartContainer config={chartConfig}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => format(new Date(value), "MMM yyyy")}
                  />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No data available for the selected period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Type Breakdown</CardTitle>
            <CardDescription>Distribution by leave type</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : summary?.summary.leave_type_breakdown && summary.summary.leave_type_breakdown.length > 0 ? (
              <div className="space-y-4">
                {summary.summary.leave_type_breakdown.map((item, index) => {
                  const percentage = (item.total_days / summary.summary.total_days_taken) * 100;
                  return (
                    <div key={item.leave_type_id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.leave_type_name}</span>
                        <span className="font-medium">{item.total_days.toFixed(1)} days</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: `var(--chart-${(index % 5) + 1})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
