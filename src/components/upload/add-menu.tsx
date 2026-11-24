"use client";

import { useRef } from "react";
import { Camera, ChevronDown, ImagePlus, PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUploadStore } from "@/lib/upload/upload-store";

export function AddMenu({ onManual }: { onManual: () => void }) {
  const addFiles = useUploadStore((s) => s.addFiles);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = "";
  }

  return (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
        data-testid="gallery-input"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Add <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            <span>
              Upload photos
              <span className="block text-xs text-muted-foreground">Pick as many as you like</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()}>
            <Camera className="h-4 w-4" /> Take a photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onManual}>
            <PenLine className="h-4 w-4" /> Enter details manually
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
