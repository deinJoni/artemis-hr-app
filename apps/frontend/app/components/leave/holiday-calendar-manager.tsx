import * as React from "react";
import { Calendar, Plus, Trash2, Upload, Download, AlertCircle, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { format, parseISO } from "date-fns";
import type { HolidayCalendar, HolidayCalendarCreateInput } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type HolidayCalendarManagerProps = {
  className?: string;
};

export function HolidayCalendarManager({ 
  className 
}: HolidayCalendarManagerProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [holidays, setHolidays] = React.useState<HolidayCalendar[]>([]);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  // Form state for adding holiday
  const [newHoliday, setNewHoliday] = React.useState<HolidayCalendarCreateInput>({
    date: "",
    name: "",
    is_half_day: false,
    country: "",
    region: "",
  });

  // Form state for bulk import
  const [bulkHolidays, setBulkHolidays] = React.useState("");
  const [bulkYear, setBulkYear] = React.useState(new Date().getFullYear());

  const loadHolidays = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/holidays?year=${selectedYear}`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setHolidays(data.holidays || []);
      } else {
        setError(data.error || "Failed to load holidays");
      }
    } catch (err) {
      setError("Failed to load holidays");
      console.error("Error loading holidays:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, selectedYear, session]);

  // Load holidays when year changes
  React.useEffect(() => {
    if (!session) return;
    
    loadHolidays();
  }, [session, selectedYear, loadHolidays]);

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/holidays`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(newHoliday),
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess("Holiday added successfully");
        setNewHoliday({
          date: "",
          name: "",
          is_half_day: false,
          country: "",
          region: "",
        });
        setAddDialogOpen(false);
        loadHolidays();
      } else {
        setError(data.error || "Failed to add holiday");
      }
    } catch (err) {
      setError("Failed to add holiday");
      console.error("Error adding holiday:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkHolidays.trim()) {
      setError("Please enter holiday data");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse CSV-like data
      const lines = bulkHolidays.trim().split('\n');
      const holidayData = lines.map(line => {
        const [date, name, isHalfDay, country, region] = line.split(',').map(s => s.trim());
        return {
          date,
          name,
          is_half_day: isHalfDay === 'true' || isHalfDay === '1',
          country: country || undefined,
          region: region || undefined,
        };
      });

      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/holidays/bulk`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          holidays: holidayData,
          year: bulkYear,
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Successfully imported ${data.count} holidays`);
        setBulkHolidays("");
        setBulkDialogOpen(false);
        loadHolidays();
      } else {
        setError(data.error || "Failed to import holidays");
      }
    } catch (err) {
      setError("Failed to import holidays");
      console.error("Error importing holidays:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    setDeleting(holidayId);
    setError(null);

    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/holidays/${holidayId}`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      if (res.ok) {
        setSuccess("Holiday deleted successfully");
        loadHolidays();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete holiday");
      }
    } catch (err) {
      setError("Failed to delete holiday");
      console.error("Error deleting holiday:", err);
    } finally {
      setDeleting(null);
    }
  };

  const exportHolidays = () => {
    const csvData = holidays.map(holiday => ({
      Date: holiday.date,
      Name: holiday.name,
      "Half Day": holiday.is_half_day ? "Yes" : "No",
      Country: holiday.country || "",
      Region: holiday.region || "",
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `holidays-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

  if (loading && holidays.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Holiday Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Holiday Calendar
            </CardTitle>
            <CardDescription>
              Manage public holidays and company-specific days off
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportHolidays}
              disabled={holidays.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="year">Year:</Label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Badge variant="outline">
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Holiday</DialogTitle>
                <DialogDescription>
                  Add a new public holiday or company-specific day off.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., New Year's Day"
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_half_day"
                      checked={newHoliday.is_half_day}
                      onCheckedChange={(checked) => setNewHoliday(prev => ({ ...prev, is_half_day: !!checked }))}
                    />
                    <Label htmlFor="is_half_day">Half day holiday</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country (Optional)</Label>
                    <Input
                      id="country"
                      placeholder="e.g., US, UK, CA"
                      value={newHoliday.country}
                      onChange={(e) => setNewHoliday(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region (Optional)</Label>
                    <Input
                      id="region"
                      placeholder="e.g., California, Ontario"
                      value={newHoliday.region}
                      onChange={(e) => setNewHoliday(prev => ({ ...prev, region: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddHoliday} disabled={loading}>
                    {loading ? "Adding..." : "Add Holiday"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import Holidays</DialogTitle>
                <DialogDescription>
                  Import multiple holidays at once using CSV format.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk_year">Year</Label>
                  <Select value={bulkYear.toString()} onValueChange={(value) => setBulkYear(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk_data">Holiday Data (CSV Format)</Label>
                  <Textarea
                    id="bulk_data"
                    placeholder="date,name,is_half_day,country,region&#10;2025-01-01,New Year's Day,false,US,&#10;2025-07-04,Independence Day,false,US,"
                    value={bulkHolidays}
                    onChange={(e) => setBulkHolidays(e.target.value)}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: date,name,is_half_day,country,region (one per line)
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkImport} disabled={loading}>
                    {loading ? "Importing..." : "Import Holidays"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Holidays Table */}
        {holidays.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No holidays configured for {selectedYear}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Add holidays to help with leave request calculations
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(holiday.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Badge variant={holiday.is_half_day ? "secondary" : "default"}>
                        {holiday.is_half_day ? "Half Day" : "Full Day"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {holiday.country && (
                        <div className="text-sm">
                          {holiday.country}
                          {holiday.region && `, ${holiday.region}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        disabled={deleting === holiday.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleting === holiday.id ? (
                          "Deleting..."
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-green-50 border border-green-200 rounded-md">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
