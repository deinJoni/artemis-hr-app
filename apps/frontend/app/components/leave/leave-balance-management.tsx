import * as React from "react";
import { Plus, Minus, Users, AlertCircle, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import type { LeaveBalanceSummary, LeaveType, Employee, LeaveBalanceAdjustmentInput } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type LeaveBalanceManagementProps = {
  className?: string;
};

export function LeaveBalanceManagement({ 
  className 
}: LeaveBalanceManagementProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [balances, setBalances] = React.useState<LeaveBalanceSummary[]>([]);
  const [selectedEmployee, setSelectedEmployee] = React.useState<string>("");
  const [selectedLeaveType, setSelectedLeaveType] = React.useState<string>("");
  const [adjustmentDays, setAdjustmentDays] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Resolve tenantId
  React.useEffect(() => {
    let cancelled = false;
    async function resolveTenant() {
      if (!session) return;
      
      try {
        const token = session.access_token;
        const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tenantJson = (await tenantRes.json()) as { id?: string };
        if (!tenantRes.ok || typeof tenantJson?.id !== "string") {
          throw new Error("Unable to resolve tenant");
        }
        if (cancelled) return;
        setTenantId(tenantJson.id);
      } catch (err) {
        console.error("Error resolving tenant:", err);
        if (!cancelled) {
          setError("Unable to resolve workspace. Please refresh the page.");
        }
      }
    }
    void resolveTenant();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, session]);

  const loadInitialData = React.useCallback(async () => {
    if (!session || !tenantId) return;
    
    setLoading(true);
    try {
      const token = session.access_token;
      const headers = { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${token}` 
      };

      // Load employees (requires tenantId)
      const employeesRes = await fetch(`${apiBaseUrl}/api/employees/${tenantId}`, { headers });
      const employeesData = await employeesRes.json();
      if (employeesRes.ok) {
        setEmployees(employeesData.employees || []);
      } else {
        console.error("Failed to load employees:", employeesData.error);
        setError(employeesData.error || "Failed to load employees");
      }

      // Load leave types (gets tenantId from session)
      const typesRes = await fetch(`${apiBaseUrl}/api/leave/types`, { headers });
      const typesData = await typesRes.json();
      if (typesRes.ok) {
        setLeaveTypes(typesData.leaveTypes || []);
      } else {
        console.error("Failed to load leave types:", typesData.error);
      }
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session, tenantId]);

  const loadEmployeeBalances = React.useCallback(async () => {
    if (!selectedEmployee || !session) return;
    
    try {
      const token = session.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/balances/${selectedEmployee}`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setBalances(data.balances || []);
      } else {
        setError(data.error || "Failed to load balances");
      }
    } catch (err) {
      setError("Failed to load employee balances");
      console.error("Error loading balances:", err);
    }
  }, [apiBaseUrl, selectedEmployee, session]);

  // Load initial data when tenantId is available
  React.useEffect(() => {
    if (!session || !tenantId) return;
    
    loadInitialData();
  }, [session, tenantId, loadInitialData]);

  // Load balances when employee changes
  React.useEffect(() => {
    if (!selectedEmployee || !session) return;
    
    loadEmployeeBalances();
  }, [selectedEmployee, session, loadEmployeeBalances]);

  const handleAdjustment = async () => {
    if (!selectedEmployee || !selectedLeaveType || !adjustmentDays || !reason.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    const days = parseFloat(adjustmentDays);
    if (isNaN(days) || days === 0) {
      setError("Adjustment days must be a valid non-zero number");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = session?.access_token;
      const adjustment: LeaveBalanceAdjustmentInput = {
        leave_type_id: selectedLeaveType,
        adjustment_days: days,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      };

      const res = await fetch(`${apiBaseUrl}/api/leave/balances/${selectedEmployee}/adjust`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(adjustment),
      });
      
      const data = await res.json();
      if (res.ok) {
        const adjustmentText = days > 0 ? `added ${days} days` : `subtracted ${Math.abs(days)} days`;
        setSuccess(`Successfully ${adjustmentText} to balance`);
        setAdjustmentDays("");
        setReason("");
        setNotes("");
        // Reload balances
        loadEmployeeBalances();
      } else {
        // Handle specific error cases
        let errorMessage = data.error || "Failed to adjust balance";
        if (res.status === 400 && data.error) {
          errorMessage = data.error;
        } else if (res.status === 403) {
          errorMessage = "You don't have permission to adjust balances";
        } else if (res.status === 404) {
          errorMessage = "Employee not found";
        }
        setError(errorMessage);
      }
    } catch (err) {
      setError("Failed to adjust balance");
      console.error("Error adjusting balance:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentBalance = () => {
    return balances.find(b => b.leave_type_id === selectedLeaveType);
  };

  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);
  const selectedLeaveTypeData = leaveTypes.find(t => t.id === selectedLeaveType);
  const currentBalance = getCurrentBalance();

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Leave Balance Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Leave Balance Management
        </CardTitle>
        <CardDescription>
          Adjust employee leave balances and track changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Employee Selection */}
        <div className="space-y-2">
          <Label htmlFor="employee">Select Employee *</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  <div className="flex items-center gap-2">
                    <span>{employee.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {employee.employee_number}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedEmployeeData && (
          <>
            {/* Employee Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{selectedEmployeeData.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedEmployeeData.email} • {selectedEmployeeData.employee_number}
                  </div>
                </div>
              </div>
            </div>

            {/* Leave Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="leave_type">Leave Type *</Label>
              <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a leave type" />
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
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Balance Display */}
            {currentBalance && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Current Balance</span>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: selectedLeaveTypeData?.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedLeaveTypeData?.name}
                    </span>
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  {currentBalance.remaining_balance.toFixed(1)} days
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentBalance.used_ytd.toFixed(1)} used of {currentBalance.balance_days.toFixed(1)} total
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, (currentBalance.used_ytd / currentBalance.balance_days) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Adjustment Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adjustment_days">Adjustment Days *</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = parseFloat(adjustmentDays) || 0;
                        setAdjustmentDays((current - 0.5).toString());
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="adjustment_days"
                      type="number"
                      step="0.5"
                      placeholder="0.0"
                      value={adjustmentDays}
                      onChange={(e) => setAdjustmentDays(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = parseFloat(adjustmentDays) || 0;
                        setAdjustmentDays((current + 0.5).toString());
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Positive values add days, negative values subtract days
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Adjustment *</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Annual allocation, Manual correction"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional details about this adjustment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleAdjustment}
                disabled={submitting || !selectedEmployee || !selectedLeaveType || !adjustmentDays || !reason.trim()}
                className="w-full"
              >
                {submitting ? (
                  "Processing..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Apply Adjustment
                  </>
                )}
              </Button>
            </div>

            {/* All Balances Table */}
            {balances.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">All Leave Balances</h3>
                  <Badge variant="outline">{balances.length} types</Badge>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Total Days</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.map((balance) => {
                        const leaveType = leaveTypes.find(t => t.id === balance.leave_type_id);
                        const isLowBalance = balance.remaining_balance < 5 && balance.remaining_balance > 0;
                        const isNegative = balance.remaining_balance < 0;
                        
                        return (
                          <TableRow key={balance.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: leaveType?.color }}
                                />
                                <span>{balance.leave_type_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{balance.balance_days.toFixed(1)}</TableCell>
                            <TableCell>{balance.used_ytd.toFixed(1)}</TableCell>
                            <TableCell className="font-medium">
                              {balance.remaining_balance.toFixed(1)}
                            </TableCell>
                            <TableCell>
                              {isNegative ? (
                                <Badge variant="destructive">Negative</Badge>
                              ) : isLowBalance ? (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                  Low Balance
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  Good
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
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
