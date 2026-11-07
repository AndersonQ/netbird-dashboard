"use client";

import { notify } from "@components/Notification";
import { useApiCall } from "@utils/api";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { useDialog } from "@/contexts/DialogProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { isWebMCPSupported, registerTool } from "./modelContext";
import { buildTools, ToolDeps } from "./tools";

/**
 * Registers the dashboard's WebMCP tools with the browser while a user is
 * logged in. Renders nothing. Mounted in DashboardLayout, below
 * PermissionsProvider and DialogProvider.
 */
export default function WebMCPProvider() {
  const { permission } = usePermissions();
  const request = useApiCall<any>("", true);
  const { mutate } = useSWRConfig();
  const { confirm } = useDialog();
  const router = useRouter();

  // Hook results change identity on every render; tools read them through a
  // ref so we only re-register when permissions change.
  const depsRef = useRef<ToolDeps>(undefined);
  const deps: ToolDeps = {
    api: {
      get: (path) => request.get(path),
      post: (path, body) => request.post(body, path),
      put: (path, body) => request.put(body, path),
      del: (path) => request.del("", path),
    },
    confirm: ({ title, description, danger }) =>
      confirm({
        title,
        description: (
          <div className={"whitespace-pre-line"}>
            {description}
            <div className={"mt-3 text-xs text-nb-gray-400"}>
              Requested by your browser assistant (WebMCP).
            </div>
          </div>
        ),
        confirmText: danger ? "Yes, do it" : "Approve",
        cancelText: "Decline",
        type: danger ? "danger" : "warning",
        maxWidthClass: "max-w-[480px]",
      }),
    refresh: (keys) => keys.forEach((k) => mutate(k)),
    navigate: (path) => router.push(path),
    announce: (title, description) =>
      notify({ title, description, duration: 4000 }),
  };

  // Runs after every render (declared before the registration effect, so it
  // is set before any tool can be called).
  useEffect(() => {
    depsRef.current = deps;
  });

  useEffect(() => {
    if (!isWebMCPSupported()) {
      console.info(
        "[webmcp] document.modelContext not available; no tools registered",
      );
      return;
    }

    // Proxy deps so every call goes through the latest hook values.
    const live: ToolDeps = {
      api: {
        get: (p) => depsRef.current!.api.get(p),
        post: (p, b) => depsRef.current!.api.post(p, b),
        put: (p, b) => depsRef.current!.api.put(p, b),
        del: (p) => depsRef.current!.api.del(p),
      },
      confirm: (o) => depsRef.current!.confirm(o),
      refresh: (k) => depsRef.current!.refresh(k),
      navigate: (p) => depsRef.current!.navigate(p),
      announce: (t, d) => depsRef.current!.announce(t, d),
    };

    const allowed = buildTools(live).filter(({ permission: need }) => {
      if (!need) return true;
      const mod = (permission as Record<string, any>)?.[need.module];
      return !!mod?.[need.op];
    });

    const unregister = allowed.map(({ tool }) => registerTool(tool));
    console.info(
      `[webmcp] registered ${allowed.length} tools:`,
      allowed.map((t) => t.tool.name),
    );
    return () => unregister.forEach((u) => u());
  }, [permission]);

  return null;
}
