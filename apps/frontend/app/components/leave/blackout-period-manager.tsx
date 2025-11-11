import * as React from "react";
import { Calendar, Plus, Trash2, Edit, AlertCircle, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Calendar as CalendarComponent } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { format, parseISO } from "date-fns";
import type { BlackoutPeriod, BlackoutPeriodCreateInput, LeaveType } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type BlackoutPeriodManagerProps = {
  className?: string;
};

export function BlackoutPeriodManager({ 
  className 
}: BlackoutPeriodManagerProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [periods, setPeriods] = React.useState<BlackoutPeriod[]>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [editingPeriod, setEditingPeriod] = React.useState<BlackoutPeriod | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  // Form state
  const [form, setForm] = React.useState<BlackoutPeriodCreateInput>({
    name: "",
    start_date: "",
    end_date: "",
    leave_type_id: null,
    department_id: null,
    reason: "",
  });

  // Load periods and leave types on mount
  const loadPeriods = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/blackout-periods`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setPeriods(data.periods || []);
      } else {
        setError(data.error || "Failed to load blackout periods");
      }
    } catch (err) {
      setError("Failed to load blackout periods");
      console.error("Error loading blackout periods:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session]);

  const loadLeaveTypes = React.useCallback(async () => {
    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/types`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setLeaveTypes(data.types || []);
      }
    } catch (err) {
      console.error("Error loading leave types:", err);
    }
  }, [apiBaseUrl, session]);

  React.useEffect(() => {
    if (!session) return;
    
    loadPeriods();
    loadLeaveTypes();
  }, [session, loadPeriods, loadLeaveTypes]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setError("Please fill in all required fields");
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError("End date must be after start date");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = session?.access_token;
      const url = editingPeriod 
        ? `${apiBaseUrl}/api/leave/blackout-periods/${editingPeriod.id}`
        : `${apiBaseUrl}/api/leave/blackout-periods`;
      const method = editingPeriod ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess(editingPeriod ? "Blackout period updated successfully" : "Blackout period created successfully");
        setAddDialogOpen(false);
        setEditingPeriod(null);
        setForm({
          name: "",
          start_date: "",
          end_date: "",
          leave_type_id: null,
          department_id: null,
          reason: "",
        });
        await loadPeriods();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save blackout period");
      }
    } catch (err) {
      setError("Failed to save blackout period");
      console.error("Error saving blackout period:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blackout period?")) {
      return;
    }

    setDeleting(id);
    setError(null);

    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/blackout-periods/${id}`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess("Blackout period deleted successfully");
        await loadPeriods();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to delete blackout period");
      }
    } catch (err) {
      setError("Failed to delete blackout period");
      console.error("Error deleting blackout period:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (period: BlackoutPeriod) => {
    setEditingPeriod(period);
    setForm({
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
      leave_type_id: period.leave_type_id || null,
      department_id: period.department_id || null,
      reason: period.reason || "",
    });
    setAddDialogOpen(true);
  };

  const handleAddClick = () => {
    setEditingPeriod(null);
    setForm({
      name: "",
      start_date: "",
      end_date: "",
      leave_type_id: null,
      department_id: null,
      reason: "",
    });
    setAddDialogOpen(true);
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Blackout Periods
            </CardTitle>
            <CardDescription>
              Manage periods when leave requests are not allowed
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddClick}>
                <Plus className="h-4 w-4 mr-2" />
                Add Blackout Period
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingPeriod ? "Edit Blackout Period" : "Add Blackout Period"}
                </DialogTitle>
                <DialogDescription>
                  {editingPeriod 
                    ? "Update the blackout period details"
                    : "Create a new period when leave requests will be blocked"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Year-End Freeze"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.start_date && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {form.start_date ? format(parseISO(form.start_date), "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={form.start_date ? parseISO(form.start_date) : undefined}
                          onSelect={(date) => {
                            if (date && date instanceof Date) {
                              setForm(prev => ({ ...prev, start_date: format(date, "yyyy-MM-dd") }));
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.end_date && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {form.end_date ? format(parseISO(form.end_date), "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={form.end_date ? parseISO(form.end_date) : undefined}
                          onSelect={(date) => {
                            if (date && date instanceof Date) {
                              setForm(prev => ({ ...prev, end_date: format(date, "yyyy-MM-dd") }));
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leave_type">Leave Type (Optional)</Label>
                  <Select
                    value={form.leave_type_id || "all"}
                    onValueChange={(value) => 
                      setForm(prev => ({ ...prev, leave_type_id: value === "all" ? null : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All leave types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All leave types</SelectItem>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to apply to all leave types
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    value={form.reason || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Explain why leave is blocked during this period"
                    rows={3}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? "Saving..." : editingPeriod ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span>{success}</span>
          </div>
        )}

        {error && !success && (
          <div className="mb-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {loading && periods.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : periods.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No blackout periods configured</p>
            <p className="text-sm">Click "Add Blackout Period" to create one</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{format(parseISO(period.start_date), "MMM d, yyyy")}</span>
                      <span className="text-xs text-muted-foreground">to</span>
                      <span>{format(parseISO(period.end_date), "MMM d, yyyy")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {period.leave_type_id ? (
                      <Badge variant="secondary">
                        {leaveTypes.find(lt => lt.id === period.leave_type_id)?.name || "Unknown"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">All Types</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {period.reason || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(period)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(period.id)}
                        disabled={deleting === period.id}
                      >
                        {deleting === period.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
