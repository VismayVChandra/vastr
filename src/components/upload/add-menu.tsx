"use client";

import { useRef } from "react";
import { Camera, ChevronDown, ImagePlus, PenLine, Plus, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUploadStore } from "@/lib/upload/upload-store";

export function AddMenu({
  onManual,
  onOutfitPhoto,
}: {
  onManual: () => void;
  onOutfitPhoto: (file: File) => void;
}) {
  const addFiles = useUploadStore((s) => s.addFiles);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const outfitRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = "";
  }

  function handleOutfitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onOutfitPhoto(file);
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
      <input
        ref={outfitRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleOutfitChange}
        data-testid="outfit-input"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Add <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => outfitRef.current?.click()}>
            <Shirt className="h-4 w-4" />
            <span>
              From an outfit photo
              <span className="block text-xs text-muted-foreground">
                Pull each piece out of one picture
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            <span>
              Upload photos
              <span className="block text-xs text-muted-foreground">One piece per photo</span>
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
