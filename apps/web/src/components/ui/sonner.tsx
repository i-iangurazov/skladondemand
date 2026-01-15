"use client"

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({
  duration = 4000,
  closeButton = true,
  position = "top-center",
  richColors = false,
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      duration={duration}
      closeButton={closeButton}
      richColors={richColors}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-primary" />,
        info: <InfoIcon className="size-4 text-primary" />,
        warning: <TriangleAlertIcon className="size-4 text-warnTint" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "bg-white text-slate-900 border border-slate-200 shadow-lg shadow-slate-100 ring-1 ring-slate-100/80 rounded-lg",
          title: "font-semibold",
          description: "text-slate-600",
          actionButton: "bg-slate-900 text-white hover:bg-slate-800",
          cancelButton: "border border-slate-200 text-slate-800 hover:bg-slate-50",
          closeButton:
            "text-muted-foreground hover:text-foreground bg-transparent border-0 shadow-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-full !important",
          success: "border-l-4 border-l-primary",
          info: "border-l-4 border-l-primary",
          warning: "border-l-4 border-l-warnTint",
          error: "border-l-4 border-l-destructive",
        },
      }}
      style={
        {
          "--normal-bg": "white",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
