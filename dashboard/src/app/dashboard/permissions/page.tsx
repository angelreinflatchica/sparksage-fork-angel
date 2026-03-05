"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, Shield, Lock, Search } from "lucide-react";
import { api, type PermissionItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AVAILABLE_COMMANDS = [
  "ask", 
  "clear", 
  "provider", 
  "summarize", 
  "review", 
  "faq", 
  "faq add", 
  "faq list", 
  "faq remove",
  "permissions",
  "permissions set",
  "permissions remove",
  "permissions list"
];

export default function PermissionsPage() {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  async function load() {
    if (!token) return;
    try {
      const result = await api.getPermissions(token);
      setPermissions(result);
    } catch {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      command_name: formData.get("command") as string,
      guild_id: formData.get("guild_id") as string,
      role_id: formData.get("role_id") as string,
    };

    setSubmitting(true);
    try {
      await api.createPermission(token, data);
      toast.success("Permission added successfully");
      setIsDialogOpen(false);
      load();
    } catch {
      toast.error("Failed to add permission");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: PermissionItem) {
    if (!token || !confirm("Are you sure you want to remove this restriction?")) return;
    try {
      await api.deletePermission(token, item.command_name, item.guild_id, item.role_id);
      toast.success("Permission removed");
      load();
    } catch {
      toast.error("Failed to remove permission");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Command Permissions</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Restriction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restrict Command to Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <select 
                  id="command" 
                  name="command" 
                  required
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {AVAILABLE_COMMANDS.map(cmd => (
                    <option key={cmd} value={cmd}>{cmd}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guild_id">Guild (Server) ID</Label>
                <Input id="guild_id" name="guild_id" placeholder="e.g. 123456789012345678" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_id">Role ID</Label>
                <Input id="role_id" name="role_id" placeholder="e.g. 876543210987654321" required />
                <p className="text-[10px] text-muted-foreground italic">
                  Users must have this role to run the command. Admins always have access.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Restriction
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {permissions.length === 0 ? (
          <Card className="py-12 text-center text-muted-foreground">
            <CardContent>
              <Shield className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>No command restrictions configured. All commands are available to everyone.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Command</th>
                  <th className="px-4 py-3 text-left">Server ID</th>
                  <th className="px-4 py-3 text-left">Role ID</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {permissions.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-primary">/{item.command_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.guild_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.role_id}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" /> Role-Based Access Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Role restrictions apply to all users except those with **Administrator** permissions in Discord. 
            If a command has multiple roles assigned, a user only needs to have **one** of those roles to gain access.
            Permission changes take effect immediately in the bot.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
