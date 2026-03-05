"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, Search, MessageCircle } from "lucide-react";
import { api, type FAQItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function FAQPage() {
  const { data: session } = useSession();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  async function load() {
    if (!token) return;
    try {
      const result = await api.getFAQs(token);
      setFaqs(result);
    } catch {
      toast.error("Failed to load FAQs");
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
      guild_id: "global", // For now, or get from bot status
      question: formData.get("question") as string,
      answer: formData.get("answer") as string,
      match_keywords: formData.get("keywords") as string,
    };

    setSubmitting(true);
    try {
      await api.createFAQ(token, data);
      toast.success("FAQ created successfully");
      setIsDialogOpen(false);
      load();
    } catch (err) {
      toast.error("Failed to create FAQ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Are you sure you want to delete this FAQ?")) return;
    try {
      await api.deleteFAQ(token, id);
      toast.success("FAQ deleted");
      load();
    } catch {
      toast.error("Failed to delete FAQ");
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
        <h1 className="text-2xl font-bold">FAQs</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add FAQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New FAQ</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Input id="question" name="question" placeholder="e.g. How do I join the server?" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer">Answer</Label>
                <Textarea id="answer" name="answer" placeholder="Provide the response the bot should give..." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Trigger Keywords (comma separated)</Label>
                <Input id="keywords" name="keywords" placeholder="e.g. join, invite, server" required />
                <p className="text-[10px] text-muted-foreground">
                  The bot will respond if any of these keywords are detected in a message.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create FAQ
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {faqs.length === 0 ? (
          <Card className="col-span-full py-12 text-center text-muted-foreground">
            <CardContent>
              <Search className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>No FAQs found. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          faqs.map((faq) => (
            <Card key={faq.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold">{faq.question}</CardTitle>
                  <CardDescription className="text-[10px]">
                    Created {new Date(faq.created_at + "Z").toLocaleDateString()}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(faq.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <p className="line-clamp-3 text-xs text-muted-foreground">{faq.answer}</p>
                <div className="mt-4 flex flex-wrap gap-1">
                  {faq.match_keywords.split(",").map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {k.trim()}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  Used {faq.times_used} times
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
