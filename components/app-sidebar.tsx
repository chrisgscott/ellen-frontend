import * as React from "react"
import { LogOut, LayoutDashboard, FlaskConical } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { SearchForm } from "@/components/search-form"
import { AppSidebarNav } from "@/components/app-sidebar-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar"

export async function AppSidebar(
  props: React.ComponentProps<typeof Sidebar>
) {
  const supabase = await createClient()
  const { data: materials, error } = await supabase
    .from("materials")
    .select("material")
    .order("material", { ascending: true })

  const navMain = [
    {
      title: "Critical Materials",
      url: "#",
      items: materials
        ? materials.map((item) => ({
            title: item.material,
            url: `/materials/${encodeURIComponent(item.material)}`,
            isActive: false, // TODO: Set this dynamically based on the current path
          }))
        : [],
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="flex h-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FlaskConical className="size-6" />
        </div>
        <SearchForm />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/">
                <LayoutDashboard className="mr-2 size-4 text-primary" />
                Dashboard
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a
                href={process.env.NEXT_PUBLIC_RESEARCHER_URL || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FlaskConical className="mr-2 size-4 text-primary" />
                Researcher
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="my-2" />
        <AppSidebarNav navMain={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <form action="/auth/sign-out" method="post" className="w-full">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="w-full justify-start">
                <button type="submit">
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
