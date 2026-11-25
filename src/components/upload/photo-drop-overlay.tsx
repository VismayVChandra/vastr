"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useUploadStore } from "@/lib/upload/upload-store";
import { isDemoSession } from "@/lib/demo";
import { useDemoPrompt } from "@/store/demo-prompt-store";

/** Lets people drag photos from their desktop anywhere onto the page. */
export function PhotoDropOverlay() {
  const addFiles = useUploadStore((s) => s.addFiles);
  const showDemoPrompt = useDemoPrompt((s) => s.show);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      if (isDemoSession()) {
        showDemoPrompt("photos");
        return;
      }
      addFiles(files);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles, showDemoPrompt]);

  if (!dragging) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent bg-card px-12 py-14 text-center shadow-xl">
        <div className="rounded-full bg-accent/10 p-4 text-accent">
          <ImagePlus className="h-7 w-7" />
        </div>
        <p className="font-display text-xl">Drop photos to add them</p>
        <p className="text-sm text-muted-foreground">Vastr will recognise each piece for you</p>
      </div>
    </div>
  );
}
