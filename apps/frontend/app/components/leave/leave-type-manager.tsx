import * as React from "react";
import { Check, Edit, Plus, Trash2, AlertCircle, Settings } from "lucide-react";
import type { LeaveType, LeaveTypeCreateInput, LeaveTypeUpdateInput } from "@vibe/shared";
import { LeaveTypeCreateInputSchema, LeaveTypeUpdateInputSchema } from "@vibe/shared";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useApiContext } from "~/lib/api-context";

type LeaveTypeFormState = {
  name: string;
  code: string;
  color: string;
  requires_approval: boolean;
  requires_certificate: boolean;
  allow_negative_balance: boolean;
  enforce_minimum_entitlement: boolean;
  max_balance: string;
  minimum_entitlement_days: string;
  is_active: boolean;
};

const DEFAULT_FORM: LeaveTypeFormState = {
  name: "",
  code: "",
  color: "#3B82F6",
  requires_approval: true,
  requires_certificate: false,
  allow_negative_balance: false,
  enforce_minimum_entitlement: false,
  max_balance: "",
  minimum_entitlement_days: "",
  is_active: true,
};

type LeaveTypeManagerProps = {
  className?: string;
};

export function LeaveTypeManager({ className }: LeaveTypeManagerProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editingType, setEditingType] = React.useState<LeaveType | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<LeaveType | null>(null);
  const [form, setForm] = React.useState<LeaveTypeFormState>(DEFAULT_FORM);
  const [showErrors, setShowErrors] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string[]>>({});

  const token = session?.access_token;

  const resetForm = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingType(null);
    setShowErrors(false);
    setFormErrors({});
  }, []);

  const normalizedPayload = React.useMemo(() => {
    const maxBalanceValue = form.max_balance.trim();
    const minEntitlementValue = form.minimum_entitlement_days.trim();
    const base: Omit<LeaveTypeCreateInput, "max_balance" | "minimum_entitlement_days"> & {
      max_balance: number | null;
      minimum_entitlement_days: number | null;
    } = {
      name: form.name.trim(),
      code: form.code.trim(),
      color: form.color,
      requires_approval: form.requires_approval,
      requires_certificate: form.requires_certificate,
      allow_negative_balance: form.allow_negative_balance,
      enforce_minimum_entitlement: form.enforce_minimum_entitlement,
      max_balance: maxBalanceValue ? Number(maxBalanceValue) : null,
      minimum_entitlement_days: minEntitlementValue ? Number(minEntitlementValue) : null,
    };

    if (Number.isNaN(base.max_balance as number)) {
      base.max_balance = null;
    }
    if (Number.isNaN(base.minimum_entitlement_days as number)) {
      base.minimum_entitlement_days = null;
    }

    if (editingType) {
      return {
        ...base,
        is_active: form.is_active,
      };
    }

    return base;
  }, [form, editingType]);

  const validationResult = React.useMemo(() => {
    return editingType
      ? LeaveTypeUpdateInputSchema.safeParse(normalizedPayload)
      : LeaveTypeCreateInputSchema.safeParse(normalizedPayload);
  }, [normalizedPayload, editingType]);

  React.useEffect(() => {
    if (validationResult.success) {
      setFormErrors({});
    } else {
      setFormErrors(validationResult.error.flatten().fieldErrors);
    }
  }, [validationResult]);

  const loadLeaveTypes = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/leave/types?include_inactive=true`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError("You do not have permission to view leave types.");
        } else {
          setError(data.error || "Failed to load leave types.");
        }
        setLeaveTypes([]);
        return;
      }

      setLeaveTypes(data.leaveTypes || data.types || []);
    } catch (err) {
      console.error("Error loading leave types:", err);
      setError("Failed to load leave types.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  React.useEffect(() => {
    if (!session) return;
    loadLeaveTypes();
  }, [session, loadLeaveTypes]);

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleCreateClick = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEditClick = (type: LeaveType) => {
    setEditingType(type);
    setForm({
      name: type.name,
      code: type.code,
      color: type.color || "#3B82F6",
      requires_approval: type.requires_approval,
      requires_certificate: type.requires_certificate,
      allow_negative_balance: type.allow_negative_balance,
      enforce_minimum_entitlement: type.enforce_minimum_entitlement,
      max_balance: type.max_balance != null ? String(type.max_balance) : "",
      minimum_entitlement_days: type.minimum_entitlement_days != null ? String(type.minimum_entitlement_days) : "",
      is_active: type.is_active,
    });
    setShowErrors(false);
    setDialogOpen(true);
  };

  const handleDeleteClick = (type: LeaveType) => {
    setDeleteTarget(type);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async () => {
    setShowErrors(true);
    if (!validationResult.success) {
      return;
    }
    if (!token) {
      setError("Your session has expired. Please refresh and try again.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const url = editingType
        ? `${apiBaseUrl}/api/leave/types/${editingType.id}`
        : `${apiBaseUrl}/api/leave/types`;
      const method = editingType ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(validationResult.data as LeaveTypeCreateInput | LeaveTypeUpdateInput),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError("You do not have permission to manage leave types.");
        } else if (data?.details?.fieldErrors) {
          setFormErrors(data.details.fieldErrors);
        } else {
          setError(data.error || "Failed to save leave type.");
        }
        return;
      }

      setSuccess(editingType ? "Leave type updated successfully." : "Leave type created successfully.");
      setTimeout(() => setSuccess(null), 3000);
      closeDialog();
      await loadLeaveTypes();
    } catch (err) {
      console.error("Error saving leave type:", err);
      setError("Failed to save leave type.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!token) {
      setError("Your session has expired. Please refresh and try again.");
      return;
    }
    setDeleteLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/leave/types/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError("You do not have permission to delete leave types.");
        } else {
          setError(data.error || "Failed to delete leave type.");
        }
        return;
      }

      setSuccess("Leave type deleted successfully.");
      setTimeout(() => setSuccess(null), 3000);
      closeDeleteDialog();
      await loadLeaveTypes();
    } catch (err) {
      console.error("Error deleting leave type:", err);
      setError("Failed to delete leave type.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderBooleanBadge = (value: boolean) => (
    <Badge className={value ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
      {value ? "Yes" : "No"}
    </Badge>
  );

  const renderStatusBadge = (value: boolean) => (
    <Badge className={value ? "bg-green-100 text-green-800 border-green-200" : "bg-rose-100 text-rose-800 border-rose-200"}>
      {value ? "Active" : "Inactive"}
    </Badge>
  );

  if (!session) {
    return null;
  }

  if (loading && leaveTypes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Leave Types
          </CardTitle>
          <CardDescription>Manage leave type definitions for your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Leave Types
          </CardTitle>
          <CardDescription>Control which leave categories are available throughout the product.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Add Leave Type
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Requires Approval</TableHead>
                <TableHead>Requires Certificate</TableHead>
                <TableHead>Allow Negative Balance</TableHead>
                <TableHead>Max Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypes.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No leave types found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                leaveTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: type.color }} />
                        <div className="flex flex-col">
                          <span className="font-medium">{type.name}</span>
                          {type.minimum_entitlement_days && (
                            <span className="text-xs text-muted-foreground">
                              Min entitlement: {type.minimum_entitlement_days} days
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {type.code}
                      </Badge>
                    </TableCell>
                    <TableCell>{renderBooleanBadge(type.requires_approval)}</TableCell>
                    <TableCell>{renderBooleanBadge(type.requires_certificate)}</TableCell>
                    <TableCell>{renderBooleanBadge(type.allow_negative_balance)}</TableCell>
                    <TableCell>{type.max_balance != null ? `${type.max_balance} days` : "—"}</TableCell>
                    <TableCell>{renderStatusBadge(type.is_active)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(type)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteClick(type)}
                        disabled={!type.is_active}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle>
            <DialogDescription>
              {editingType
                ? "Update leave type settings. Changes apply immediately everywhere."
                : "Create a new leave type to make it available in requests, balances, and calendars."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-name">Name *</Label>
                <Input
                  id="leave-name"
                  placeholder="Vacation"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                {showErrors && formErrors.name && <p className="text-sm text-red-600">{formErrors.name[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-code">Code *</Label>
                <Input
                  id="leave-code"
                  placeholder="VACATION"
                  value={form.code}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))
                  }
                />
                {showErrors && formErrors.code && <p className="text-sm text-red-600">{formErrors.code[0]}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  className="h-10 w-16 p-1"
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  placeholder="#3B82F6"
                />
              </div>
              {showErrors && formErrors.color && <p className="text-sm text-red-600">{formErrors.color[0]}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-balance">Max Balance (days)</Label>
                <Input
                  id="max-balance"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Optional"
                  value={form.max_balance}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_balance: e.target.value }))}
                />
                {showErrors && formErrors.max_balance && <p className="text-sm text-red-600">{formErrors.max_balance[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum-entitlement">Minimum Entitlement (days)</Label>
                <Input
                  id="minimum-entitlement"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Optional"
                  value={form.minimum_entitlement_days}
                  onChange={(e) => setForm((prev) => ({ ...prev, minimum_entitlement_days: e.target.value }))}
                  disabled={!form.enforce_minimum_entitlement}
                />
                {showErrors && formErrors.minimum_entitlement_days && (
                  <p className="text-sm text-red-600">{formErrors.minimum_entitlement_days[0]}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id="requires-approval"
                  checked={form.requires_approval}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, requires_approval: Boolean(checked) }))}
                />
                <Label htmlFor="requires-approval" className="flex-1">
                  Requires approval
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id="requires-certificate"
                  checked={form.requires_certificate}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, requires_certificate: Boolean(checked) }))
                  }
                />
                <Label htmlFor="requires-certificate" className="flex-1">
                  Requires certificate
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id="allow-negative"
                  checked={form.allow_negative_balance}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, allow_negative_balance: Boolean(checked) }))
                  }
                />
                <Label htmlFor="allow-negative" className="flex-1">
                  Allow negative balance
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id="enforce-minimum"
                  checked={form.enforce_minimum_entitlement}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, enforce_minimum_entitlement: Boolean(checked) }))
                  }
                />
                <Label htmlFor="enforce-minimum" className="flex-1">
                  Enforce minimum entitlement
                </Label>
              </div>
            </div>
            {editingType && (
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id="is-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))}
                />
                <Label htmlFor="is-active" className="flex-1">
                  Leave type is active
                </Label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleFormSubmit} disabled={!validationResult.success || saving}>
                {saving ? "Saving..." : editingType ? "Save Changes" : "Create Leave Type"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => (open ? setDeleteDialogOpen(true) : closeDeleteDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete leave type</DialogTitle>
            <DialogDescription>
              This will deactivate the leave type and remove it from all dropdowns. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? Leave types that are
              already used in requests or balances cannot be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDeleteDialog} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
