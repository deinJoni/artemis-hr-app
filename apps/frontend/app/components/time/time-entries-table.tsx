import * as React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Clock, X, Calendar, Filter } from "lucide-react";
import type { TimeEntry, TimeEntryListQuery } from "@vibe/shared";
import { cn } from "~/lib/utils";

type TimeEntriesTableProps = {
  entries: TimeEntry[];
  loading?: boolean;
  onEdit?: (entry: TimeEntry) => void;
  onDelete?: (entry: TimeEntry) => void;
  onRefresh?: () => void;
  filters?: TimeEntryListQuery;
  onFiltersChange?: (filters: Partial<TimeEntryListQuery>) => void;
};

export function TimeEntriesTable({
  entries,
  loading = false,
  onEdit,
  onDelete,
  onRefresh,
  filters = { page: 1, page_size: 10 },
  onFiltersChange,
}: TimeEntriesTableProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editData, setEditData] = React.useState<Partial<TimeEntry>>({});

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timeString: string) => {
    return new Date(timeString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEntryTypeBadge = (type: string) => {
    switch (type) {
      case 'clock':
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Clock</Badge>;
      case 'manual':
        return <Badge variant="outline">Manual</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    if (onEdit) {
      onEdit(entry);
    } else {
      // Fallback to inline editing if no handler provided
      setEditingId(entry.id);
      setEditData({
        clock_in_at: entry.clock_in_at,
        clock_out_at: entry.clock_out_at,
        break_minutes: entry.break_minutes,
        project_task: entry.project_task || '',
        notes: entry.notes || '',
      });
    }
  };

  const handleSaveEdit = async (entry: TimeEntry) => {
    if (!editingId || editingId !== entry.id) return;
    
    // Optimistic update
    const originalData = { ...editData };
    setEditingId(null);
    setEditData({});
    
    try {
      // Call the edit handler if provided, otherwise refresh
      if (onEdit) {
        await onEdit({ ...entry, ...editData } as TimeEntry);
      }
      onRefresh?.();
    } catch (error) {
      // Revert on error
      setEditingId(entry.id);
      setEditData(originalData);
      console.error('Failed to save edit:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleDelete = (entry: TimeEntry) => {
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      onDelete?.(entry);
    }
  };

  // All hooks must be called before any conditional returns
  const activeFilters = React.useMemo(() => {
    const active: Array<{ key: string; label: string; value: string }> = [];
    if (filters.start_date) active.push({ key: 'start_date', label: 'Start', value: filters.start_date });
    if (filters.end_date) active.push({ key: 'end_date', label: 'End', value: filters.end_date });
    if (filters.status) active.push({ key: 'status', label: 'Status', value: filters.status });
    if (filters.entry_type) active.push({ key: 'entry_type', label: 'Type', value: filters.entry_type });
    if (filters.project_task) active.push({ key: 'project_task', label: 'Project', value: filters.project_task });
    return active;
  }, [filters]);

  const quickFilterPresets = React.useMemo(() => [
    { label: "Today", start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0] },
    { label: "This Week", start_date: (() => {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      return monday.toISOString().split('T')[0];
    })(), end_date: new Date().toISOString().split('T')[0] },
    { label: "This Month", start_date: (() => {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    })(), end_date: new Date().toISOString().split('T')[0] },
  ], []);

  const removeFilter = (key: string) => {
    onFiltersChange?.({ [key]: undefined });
  };

  const clearAllFilters = () => {
    onFiltersChange?.({
      start_date: undefined,
      end_date: undefined,
      status: undefined,
      entry_type: undefined,
      project_task: undefined,
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Quick filters:</span>
        {quickFilterPresets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange?.({ start_date: preset.start_date, end_date: preset.end_date })}
            className="h-8 text-xs"
          >
            <Calendar className="h-3 w-3 mr-1.5" />
            {preset.label}
          </Button>
        ))}
        {(filters.start_date || filters.end_date) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange?.({ start_date: undefined, end_date: undefined })}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1.5" />
            Clear Dates
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="flex items-center gap-1.5 px-2 py-1"
            >
              <span className="text-xs">
                {filter.label}: {filter.value}
              </span>
              <button
                type="button"
                onClick={() => removeFilter(filter.key)}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Advanced Filters (Collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Advanced Filters
        </summary>
        <div className="mt-3 flex flex-wrap gap-4 items-end p-4 rounded-lg border border-border/60 bg-muted/20">
          <div className="space-y-2">
            <Label htmlFor="start-date" className="text-xs">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => onFiltersChange?.({ start_date: e.target.value || undefined })}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date" className="text-xs">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={filters.end_date || ''}
              onChange={(e) => onFiltersChange?.({ end_date: e.target.value || undefined })}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status" className="text-xs">Status</Label>
            <select
              id="status"
              value={filters.status || ''}
              onChange={(e) => onFiltersChange?.({ status: e.target.value as any || undefined })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-type" className="text-xs">Type</Label>
            <select
              id="entry-type"
              value={filters.entry_type || ''}
              onChange={(e) => onFiltersChange?.({ entry_type: e.target.value as any || undefined })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All Types</option>
              <option value="clock">Clock In/Out</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project" className="text-xs">Project</Label>
            <Input
              id="project"
              placeholder="Filter by project..."
              value={filters.project_task || ''}
              onChange={(e) => onFiltersChange?.({ project_task: e.target.value || undefined })}
              className="h-9"
            />
          </div>
        </div>
      </details>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Net Hours</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No time entries found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className="group hover:bg-muted/30">
                  <TableCell className="font-medium">
                    {formatDate(entry.clock_in_at)}
                  </TableCell>
                  <TableCell
                    className={cn(editingId === entry.id && "bg-muted/50")}
                    onClick={() => !editingId && handleEdit(entry)}
                  >
                    {editingId === entry.id ? (
                      <Input
                        type="time"
                        value={editData.clock_in_at ? new Date(editData.clock_in_at).toTimeString().slice(0, 5) : ''}
                        onChange={(e) => {
                          const date = new Date(entry.clock_in_at);
                          const [hours, minutes] = e.target.value.split(':');
                          date.setHours(parseInt(hours), parseInt(minutes));
                          setEditData(prev => ({ ...prev, clock_in_at: date.toISOString() }));
                        }}
                        className="w-24 h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="cursor-pointer hover:text-primary transition-colors">
                        {formatTime(entry.clock_in_at)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(editingId === entry.id && "bg-muted/50")}
                    onClick={() => !editingId && entry.clock_out_at && handleEdit(entry)}
                  >
                    {editingId === entry.id ? (
                      <Input
                        type="time"
                        value={editData.clock_out_at ? new Date(editData.clock_out_at).toTimeString().slice(0, 5) : ''}
                        onChange={(e) => {
                          if (editData.clock_in_at) {
                            const date = new Date(editData.clock_in_at);
                            const [hours, minutes] = e.target.value.split(':');
                            date.setHours(parseInt(hours), parseInt(minutes));
                            setEditData(prev => ({ ...prev, clock_out_at: date.toISOString() }));
                          }
                        }}
                        className="w-24 h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={cn(entry.clock_out_at && "cursor-pointer hover:text-primary transition-colors")}>
                        {entry.clock_out_at ? formatTime(entry.clock_out_at) : '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(editingId === entry.id && "bg-muted/50")}
                    onClick={() => !editingId && handleEdit(entry)}
                  >
                    {editingId === entry.id ? (
                      <Input
                        type="number"
                        value={editData.break_minutes || 0}
                        onChange={(e) => setEditData(prev => ({ ...prev, break_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-20 h-8"
                        min="0"
                        max="1440"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="cursor-pointer hover:text-primary transition-colors">
                        {entry.break_minutes || 0}m
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDuration(entry.duration_minutes)}
                  </TableCell>
                  <TableCell>
                    {formatDuration(
                      entry.duration_minutes 
                        ? Math.max(0, entry.duration_minutes - (entry.break_minutes || 0))
                        : null
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(editingId === entry.id && "bg-muted/50")}
                    onClick={() => !editingId && handleEdit(entry)}
                  >
                    {editingId === entry.id ? (
                      <Input
                        value={editData.project_task || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, project_task: e.target.value }))}
                        placeholder="Project/Task"
                        className="w-32 h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="cursor-pointer hover:text-primary transition-colors">
                        {entry.project_task || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getEntryTypeBadge(entry.entry_type)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(entry.approval_status)}
                  </TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveEdit(entry)}
                          className="h-7 text-xs"
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleCancelEdit}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit entry"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(entry)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(entry)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
