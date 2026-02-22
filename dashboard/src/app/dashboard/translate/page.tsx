"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, Languages, Hash, Power, PowerOff, Info, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function TranslatePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [targetLang, setTargetLang] = useState("English");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;
    api.getConfig(token).then(({ config }) => {
      setEnabled(config.TRANSLATE_AUTO_ENABLED === "1");
      setChannelId(config.TRANSLATE_AUTO_CHANNEL_ID || "");
      setTargetLang(config.TRANSLATE_AUTO_TARGET || "English");
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load configuration");
      setLoading(false);
    });
  }, [token]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateConfig(token, {
        TRANSLATE_AUTO_ENABLED: enabled ? "1" : "0",
        TRANSLATE_AUTO_CHANNEL_ID: channelId,
        TRANSLATE_AUTO_TARGET: targetLang,
      });
      toast.success("Translation settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold">Translation</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Multilingual Assistant
            </CardTitle>
            <CardDescription>
              Configure auto-translation for multilingual channels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-Translation</Label>
                <p className="text-xs text-muted-foreground">
                  Status: {enabled ? "Active" : "Disabled"}
                </p>
              </div>
              <Button 
                variant={enabled ? "default" : "outline"}
                onClick={() => setEnabled(!enabled)}
                className="w-32"
              >
                {enabled ? (
                  <><Power className="mr-2 h-4 w-4" /> Enabled</>
                ) : (
                  <><PowerOff className="mr-2 h-4 w-4" /> Disabled</>
                )}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target-lang" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Target Language
                </Label>
                <Input
                  id="target-lang"
                  placeholder="e.g. English, Spanish, Japanese"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Auto-Translate Channel ID
                </Label>
                <Input
                  id="channel"
                  placeholder="e.g. 123456789012345678"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[10px]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="text-muted-foreground space-y-1">
                <p>
                  SparkSage can automatically translate messages in a specific channel. 
                  It detects the language of incoming messages and translates them to your 
                  target language if they don't already match.
                </p>
                <p>
                  <strong>Tip:</strong> Users can also use the <code>/translate</code> command 
                  anywhere to translate specific snippets of text manually.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
