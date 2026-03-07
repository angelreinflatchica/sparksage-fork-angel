"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Zap,
  LayoutDashboard,
  Cpu,
  Settings,
  MessageSquare,
  Wand2,
  LogOut,
  Users,
  Shield,
  Calendar,
  ShieldAlert,
  Languages,
  BarChart3,
  Puzzle,
  DollarSign,
  Gauge,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { ClientOnly } from "@/components/client-only";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const CORE_NAV_ITEMS = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { title: "Quota", href: "/dashboard/quota", icon: Gauge },
  { title: "Cost Tracking", href: "/dashboard/cost-tracking", icon: DollarSign },
  { title: "Plugins", href: "/dashboard/plugins", icon: Puzzle },
];

const SETTINGS_NAV_ITEMS = [
  { title: "General", href: "/dashboard/settings?tab=general", icon: Settings, tab: "general" },
  { title: "Daily Digest", href: "/dashboard/settings?tab=digest", icon: Calendar, tab: "digest" },
  { title: "Providers", href: "/dashboard/providers", icon: Cpu },
  { title: "Onboarding", href: "/dashboard/onboarding", icon: Users },
  { title: "FAQs", href: "/dashboard/faq", icon: MessageSquare },
  { title: "Permissions", href: "/dashboard/permissions", icon: Shield },
];

const AI_CONTROL_ITEMS = [
  { title: "Translation", href: "/dashboard/settings?tab=translation", icon: Languages, tab: "translation" },
  { title: "Channel Providers", href: "/dashboard/settings?tab=channel-providers", icon: Cpu, tab: "channel-providers" },
  { title: "Prompts", href: "/dashboard/settings?tab=prompts", icon: MessageSquare, tab: "prompts" },
  { title: "Moderation", href: "/dashboard/settings?tab=moderation", icon: ShieldAlert, tab: "moderation" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setTheme, resolvedTheme } = useTheme();
  const activeSettingsTab = searchParams.get("tab") || "general";

  const isNavItemActive = (item: { href: string; tab?: string }) => {
    if (item.tab) {
      return pathname === "/dashboard/settings" && activeSettingsTab === item.tab;
    }
    return pathname === item.href;
  };

  const hasActiveSettingsItem = SETTINGS_NAV_ITEMS.some((item) => isNavItemActive(item));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const effectiveSettingsOpen = hasActiveSettingsItem || settingsOpen;

  return (
    <Sidebar>
      <SidebarHeader>
        <ClientOnly>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-semibold">SparkSage</span>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                <Sun className={`h-[1.2rem] w-[1.2rem] transition-opacity ${resolvedTheme === "light" ? "opacity-100" : "opacity-0"}`} />
                <Moon className={`absolute h-[1.2rem] w-[1.2rem] transition-opacity ${resolvedTheme === "dark" ? "opacity-100" : "opacity-0"}`} />
              </Button>
            </div>
          </div>
        </ClientOnly>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CORE_NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Collapsible open={effectiveSettingsOpen} onOpenChange={setSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={hasActiveSettingsItem}>
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 transition-transform ${effectiveSettingsOpen ? "rotate-180" : ""}`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 space-y-1 pl-6">
                      {SETTINGS_NAV_ITEMS.map((item) => (
                        <SidebarMenuButton key={item.href} asChild isActive={isNavItemActive(item)} className="h-7 text-xs">
                          <Link href={item.href}>
                            <item.icon className="h-3.5 w-3.5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>AI Controls</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {AI_CONTROL_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isNavItemActive(item)}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/wizard"}>
                  <Link href="/wizard">
                    <Wand2 className="h-4 w-4" />
                    <span>Setup Wizard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
