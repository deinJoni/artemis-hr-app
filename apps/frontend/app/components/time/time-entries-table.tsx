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
import { MoreHorizontal, Edit, Trash2, Clock } from "lucide-react";
import type { TimeEntry, TimeEntryListQuery } from "@vibe/shared";

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
  filters = {},
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
    setEditingId(entry.id);
    setEditData({
      start_time: formatTime(entry.clock_in_at),
      end_time: entry.clock_out_at ? formatTime(entry.clock_out_at) : '',
      break_minutes: entry.break_minutes,
      project_task: entry.project_task || '',
      notes: entry.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    // TODO: Implement API call to update entry
    console.log('Saving edit for', editingId, editData);
    
    setEditingId(null);
    setEditData({});
    onRefresh?.();
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
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Input
            id="start-date"
            type="date"
            value={filters.start_date || ''}
            onChange={(e) => onFiltersChange?.({ start_date: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Input
            id="end-date"
            type="date"
            value={filters.end_date || ''}
            onChange={(e) => onFiltersChange?.({ end_date: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={filters.status || ''}
            onChange={(e) => onFiltersChange?.({ status: e.target.value as any || undefined })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry-type">Type</Label>
          <select
            id="entry-type"
            value={filters.entry_type || ''}
            onChange={(e) => onFiltersChange?.({ entry_type: e.target.value as any || undefined })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All Types</option>
            <option value="clock">Clock In/Out</option>
            <option value="manual">Manual Entry</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Input
            id="project"
            placeholder="Filter by project..."
            value={filters.project_task || ''}
            onChange={(e) => onFiltersChange?.({ project_task: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No time entries found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {formatDate(entry.clock_in_at)}
                  </TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <Input
                        type="time"
                        value={editData.start_time || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-24"
                      />
                    ) : (
                      formatTime(entry.clock_in_at)
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <Input
                        type="time"
                        value={editData.end_time || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-24"
                      />
                    ) : (
                      entry.clock_out_at ? formatTime(entry.clock_out_at) : '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <Input
                        type="number"
                        value={editData.break_minutes || 0}
                        onChange={(e) => setEditData(prev => ({ ...prev, break_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-20"
                        min="0"
                        max="1440"
                      />
                    ) : (
                      `${entry.break_minutes || 0}m`
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDuration(entry.duration_minutes)}
                  </TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <Input
                        value={editData.project_task || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, project_task: e.target.value }))}
                        placeholder="Project/Task"
                        className="w-32"
                      />
                    ) : (
                      entry.project_task || '—'
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
                        <Button size="sm" onClick={handleSaveEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
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
