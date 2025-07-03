import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, User, FileText, Settings, Users, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

interface ChangeLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: string;
  userId: number;
  userEmail: string;
  timestamp: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export default function ChangeLogsPage() {
  const { user } = useAuth();
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const { data: changeLogs, isLoading } = useQuery<ChangeLog[]>({
    queryKey: ['/api/change-logs', { limit, offset, entityType: filterEntityType, action: filterAction }],
    enabled: user?.role === 'admin',
  });

  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600 dark:text-gray-400">
                You need administrator privileges to view change logs.
              </p>
              <Button asChild className="mt-4">
                <Link href="/">Return to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'user': return <Users className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'attendee': return <User className="h-4 w-4" />;
      case 'setting': return <Settings className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatChanges = (changes: string) => {
    try {
      const parsed = JSON.parse(changes);
      return Object.entries(parsed).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-medium">{key}:</span> {String(value)}
        </div>
      ));
    } catch {
      return <div className="text-sm">{changes}</div>;
    }
  };

  const filteredLogs = changeLogs?.filter(log => {
    if (filterEntityType && filterEntityType !== "all" && log.entityType !== filterEntityType) return false;
    if (filterAction && filterAction !== "all" && log.action !== filterAction) return false;
    return true;
  }) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Change Logs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View system activity and modifications
          </p>
        </div>
        <Button asChild variant="outline" className="bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700">
          <Link href="/settings">Back to Settings</Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Entity Type</label>
              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="All entity types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entity types</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="attendee">Attendees</SelectItem>
                  <SelectItem value="setting">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Records per page</label>
              <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Log ({filteredLogs.length} entries)
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading change logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No change logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(log.timestamp), 'HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{log.userEmail}</div>
                            <div className="text-sm text-gray-500">ID: {log.userId}</div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>
                          {log.action.toUpperCase()}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(log.entityType)}
                          <div>
                            <div className="font-medium capitalize">{log.entityType}</div>
                            {log.entityId && (
                              <div className="text-sm text-gray-500">ID: {log.entityId}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="max-w-xs overflow-hidden">
                          {formatChanges(log.changes)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm text-gray-500">
                          {log.ipAddress && (
                            <div>IP: {log.ipAddress}</div>
                          )}
                          {log.userAgent && (
                            <div className="truncate max-w-xs" title={log.userAgent}>
                              {log.userAgent.split(' ')[0]}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination */}
          {filteredLogs.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {offset + 1} to {Math.min(offset + limit, offset + filteredLogs.length)} of {filteredLogs.length} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= filteredLogs.length}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}