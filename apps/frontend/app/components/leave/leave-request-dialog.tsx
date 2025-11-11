import * as React from "react";
import { Calendar, Upload, AlertCircle, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Calendar as CalendarComponent } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { format, startOfMonth, endOfMonth, isWeekend } from "date-fns";
import type { 
  CreateLeaveRequestInput, 
  LeaveType, 
  LeaveBalanceSummary, 
  HolidayCalendar,
  TeamLeaveCalendarEvent 
} from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";
import { useToast } from "~/components/toast";

type LeaveRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
};

export function LeaveRequestDialog({ 
  open, 
  onOpenChange, 
  onSubmitted 
}: LeaveRequestDialogProps) {
  const { session, apiBaseUrl } = useApiContext();
  const toast = useToast();
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [form, setForm] = React.useState<CreateLeaveRequestInput>({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    leave_type_id: "",
    half_day_start: false,
    half_day_end: false,
    note: "",
    attachment: "",
  });
  
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [balances, setBalances] = React.useState<LeaveBalanceSummary[]>([]);
  const [holidays, setHolidays] = React.useState<HolidayCalendar[]>([]);
  const [teamEvents, setTeamEvents] = React.useState<TeamLeaveCalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = React.useState<LeaveType | null>(null);
  const [workingDays, setWorkingDays] = React.useState<number>(0);
  const [conflicts, setConflicts] = React.useState<string[]>([]);

  // Track window width for responsive calendar
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load initial data
  React.useEffect(() => {
    if (!open || !session) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const token = session.access_token;
        const headers = { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        };

        // Load leave types
        const typesRes = await fetch(`${apiBaseUrl}/api/leave/types`, { headers });
        const typesData = await typesRes.json();
        if (typesRes.ok) {
          setLeaveTypes(typesData.leaveTypes || []);
        }

        // Load balances
        const balancesRes = await fetch(`${apiBaseUrl}/api/leave/balances/my-balance`, { headers });
        const balancesData = await balancesRes.json();
        if (balancesRes.ok) {
          setBalances(balancesData.balances || []);
        }

        // Load holidays for current year
        const year = new Date().getFullYear();
        const holidaysRes = await fetch(`${apiBaseUrl}/api/leave/holidays?year=${year}`, { headers });
        const holidaysData = await holidaysRes.json();
        if (holidaysRes.ok) {
          setHolidays(holidaysData.holidays || []);
        }

        // Load team calendar for current month
        const startDate = startOfMonth(new Date()).toISOString().slice(0, 10);
        const endDate = endOfMonth(new Date()).toISOString().slice(0, 10);
        const calendarRes = await fetch(
          `${apiBaseUrl}/api/leave/team-calendar?start_date=${startDate}&end_date=${endDate}`,
          { headers }
        );
        const calendarData = await calendarRes.json();
        if (calendarRes.ok) {
          setTeamEvents(calendarData.events || []);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, session, apiBaseUrl]);

  // Calculate working days and conflicts when dates or leave type change
  React.useEffect(() => {
    if (!form.start_date || !form.end_date || !selectedLeaveType) {
      setWorkingDays(0);
      setConflicts([]);
      return;
    }

    const startDate = new Date(form.start_date);
    const endDate = new Date(form.end_date);
    
    if (startDate > endDate) {
      setWorkingDays(0);
      return;
    }

    // Calculate working days (excluding weekends and holidays)
    let days = 0;
    const current = new Date(startDate);
    const conflictsList: string[] = [];

    while (current <= endDate) {
      const isWeekendDay = isWeekend(current);
      const isHoliday = holidays.some(h => h.date === current.toISOString().slice(0, 10));
      
      if (!isWeekendDay && !isHoliday) {
        days++;
      }

      // Check for team conflicts
      const dayStr = current.toISOString().slice(0, 10);
      const dayConflicts = teamEvents.filter(event => 
        event.type === 'leave_request' && 
        event.status === 'approved' &&
        dayStr >= event.start && 
        dayStr <= event.end
      );
      
      if (dayConflicts.length > 0) {
        conflictsList.push(`${format(current, 'MMM d')}: ${dayConflicts.map(c => c.employee_name).join(', ')}`);
      }

      current.setDate(current.getDate() + 1);
    }

    setWorkingDays(days);
    setConflicts(conflictsList);
  }, [form.start_date, form.end_date, selectedLeaveType, holidays, teamEvents]);

  // Update selected leave type when form changes
  React.useEffect(() => {
    if (form.leave_type_id) {
      const type = leaveTypes.find(t => t.id === form.leave_type_id);
      setSelectedLeaveType(type || null);
    } else {
      setSelectedLeaveType(null);
    }
  }, [form.leave_type_id, leaveTypes]);

  const handleSubmit = async () => {
    if (!session || !selectedLeaveType) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const token = session.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/requests`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(form),
      });
      
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Handle compliance errors with better messaging
        const errorMessage = payload?.error || res.statusText;
        const errorCode = payload?.error_code;
        
        // Show specific error messages based on error code
        if (errorCode === 'BLACKOUT_PERIOD_CONFLICT') {
          const blackoutPeriod = payload?.details;
          if (blackoutPeriod) {
            setError(`Leave request conflicts with blackout period: ${blackoutPeriod.name} (${format(new Date(blackoutPeriod.start_date), 'MMM d')} - ${format(new Date(blackoutPeriod.end_date), 'MMM d')}). ${blackoutPeriod.reason ? `Reason: ${blackoutPeriod.reason}` : ''}`);
          } else {
            setError('Leave request conflicts with a blackout period. Please select different dates.');
          }
        } else if (errorCode === 'MINIMUM_ENTITLEMENT_VIOLATION') {
          setError(errorMessage || 'This request would leave unused days below the minimum entitlement requirement. Please use more days before the period ends.');
        } else if (errorCode === 'INSUFFICIENT_BALANCE') {
          setError(errorMessage || 'Insufficient leave balance for this request.');
        } else {
          setError(errorMessage);
        }
        return;
      }
      
      toast.showToast("Leave request submitted successfully", "success");
      onOpenChange(false);
      onSubmitted?.();
      
      // Reset form
      setForm({
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        leave_type_id: "",
        half_day_start: false,
        half_day_end: false,
        note: "",
        attachment: "",
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unable to submit request";
      setError(errorMessage);
      toast.showToast(errorMessage, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const currentBalance = selectedLeaveType 
    ? balances.find(b => b.leave_type_id === selectedLeaveType.id)
    : null;

  const canSubmit = selectedLeaveType && 
    workingDays > 0 && 
    currentBalance && 
    (currentBalance.remaining_balance >= workingDays || selectedLeaveType.allow_negative_balance);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Time Off
          </DialogTitle>
          <DialogDescription>
            Submit a new leave request with automatic balance validation and conflict detection.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Leave Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="leave_type">Leave Type *</Label>
              {leaveTypes.length > 0 ? (
                <Select
                  value={form.leave_type_id || ""}
                  onValueChange={(value) => setForm(prev => ({ ...prev, leave_type_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: type.color }}
                          />
                          <span>{type.name}</span>
                          {type.requires_certificate && (
                            <Badge variant="secondary" className="text-xs">Certificate Required</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  No leave types available. Please contact your administrator to set up leave types.
                </div>
              )}
            </div>

            {/* Balance Display */}
            {currentBalance && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Current Balance</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {currentBalance.remaining_balance.toFixed(1)} days
                    </span>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Total: {currentBalance.balance_days} days</div>
                      <div>Used: {currentBalance.used_ytd} days</div>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (currentBalance.used_ytd / currentBalance.balance_days) * 100)}%` 
                      }}
                    />
                  </div>
                  {selectedLeaveType?.enforce_minimum_entitlement && selectedLeaveType?.minimum_entitlement_days && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3" />
                        <span>
                          Minimum entitlement: {selectedLeaveType.minimum_entitlement_days} days must be used before period ends
                        </span>
                      </div>
                      {currentBalance.remaining_balance > selectedLeaveType.minimum_entitlement_days && (
                        <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          You have {currentBalance.remaining_balance - selectedLeaveType.minimum_entitlement_days} days that must be used.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Date Selection with Inline Calendar */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        {form.start_date ? format(new Date(form.start_date), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={form.start_date ? new Date(form.start_date) : undefined}
                        onSelect={(date) => {
                          if (date && date instanceof Date) {
                            setForm(prev => ({ 
                              ...prev, 
                              start_date: date.toISOString().slice(0, 10),
                              // Auto-set end_date if start is after end
                              end_date: prev.end_date && date > new Date(prev.end_date) 
                                ? date.toISOString().slice(0, 10)
                                : prev.end_date
                            }));
                          }
                        }}
                        disabled={(date) => date < new Date()}
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
                        {form.end_date ? format(new Date(form.end_date), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={form.end_date ? new Date(form.end_date) : undefined}
                        onSelect={(date) => {
                          if (date && date instanceof Date) {
                            setForm(prev => ({ 
                              ...prev, 
                              end_date: date.toISOString().slice(0, 10)
                            }));
                          }
                        }}
                        disabled={(date) => {
                          if (!form.start_date) return date < new Date();
                          return date < new Date(form.start_date);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground">Quick select:</span>
                {[
                  { label: "Today", days: 0 },
                  { label: "Tomorrow", days: 1 },
                  { label: "Next Week", days: 7 },
                ].map((preset) => {
                  const date = new Date();
                  date.setDate(date.getDate() + preset.days);
                  const dateStr = date.toISOString().slice(0, 10);
                  return (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          start_date: dateStr,
                          end_date: prev.end_date && new Date(prev.end_date) >= date ? prev.end_date : dateStr,
                        }));
                      }}
                      className="h-7 text-xs"
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              
              {/* Inline Calendar Range Picker */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <Label className="text-sm font-medium mb-3 block">Select Date Range</Label>
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: form.start_date ? new Date(form.start_date) : undefined,
                    to: form.end_date ? new Date(form.end_date) : undefined,
                  }}
                  onSelect={(range) => {
                    if (range && typeof range === "object" && "from" in range) {
                      const from = range.from;
                      if (from) {
                        setForm(prev => ({
                          ...prev,
                          start_date: from.toISOString().slice(0, 10),
                          end_date: range.to ? range.to.toISOString().slice(0, 10) : prev.end_date || from.toISOString().slice(0, 10),
                        }));
                      }
                    }
                  }}
                  disabled={(date) => date < new Date()}
                  numberOfMonths={windowWidth > 768 ? 2 : 1}
                  className="rounded-md"
                />
              </div>
            </div>

            {/* Half Day Options */}
            <div className="space-y-3">
              <Label>Half Day Options</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="half_day_start"
                    checked={form.half_day_start}
                    onCheckedChange={(checked) => 
                      setForm(prev => ({ ...prev, half_day_start: !!checked }))
                    }
                  />
                  <Label htmlFor="half_day_start" className="text-sm">
                    Half day (AM) on start date
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="half_day_end"
                    checked={form.half_day_end}
                    onCheckedChange={(checked) => 
                      setForm(prev => ({ ...prev, half_day_end: !!checked }))
                    }
                  />
                  <Label htmlFor="half_day_end" className="text-sm">
                    Half day (PM) on end date
                  </Label>
                </div>
              </div>
            </div>

            {/* Working Days Summary */}
            {workingDays > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {workingDays} working day{workingDays !== 1 ? 's' : ''} requested
                    </span>
                  </div>
                  {form.half_day_start && (
                    <div className="text-xs text-muted-foreground mt-1">
                      -0.5 days for half day start
                    </div>
                  )}
                  {form.half_day_end && (
                    <div className="text-xs text-muted-foreground mt-1">
                      -0.5 days for half day end
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Conflicts Warning */}
            {conflicts.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-800">Team Conflicts Detected</div>
                      <div className="text-sm text-amber-700 mt-1">
                        Other team members are also off during this period:
                      </div>
                      <ul className="text-xs text-amber-600 mt-1 space-y-1">
                        {conflicts.map((conflict, index) => (
                          <li key={index}>• {conflict}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="note">Notes (Optional)</Label>
              <Textarea
                id="note"
                placeholder="Add any additional information about your leave request..."
                value={form.note}
                onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                rows={3}
              />
            </div>

            {/* File Upload for Certificates */}
            {selectedLeaveType?.requires_certificate && (
              <div className="space-y-2">
                <Label htmlFor="attachment">Medical Certificate *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="attachment"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // In a real implementation, you'd upload to Supabase Storage
                        // For now, we'll just store the file name
                        setForm(prev => ({ ...prev, attachment: file.name }));
                      }
                    }}
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a medical certificate or supporting document (PDF, JPG, PNG)
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
