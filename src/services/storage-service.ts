import { usesSupabase } from "@/lib/demo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { uid } from "@/lib/utils";

/** Uploads a wardrobe photo to Supabase Storage when configured; otherwise
 *  just returns the data URL as-is so it can be stored inline in local mode. */
export async function persistWardrobeImage(userId: string, dataUrl: string): Promise<string> {
  if (!usesSupabase()) return dataUrl;

  const supabase = getSupabaseBrowserClient()!;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return dataUrl;

  const [, mediaType, base64] = match;
  const ext = mediaType.split("/")[1] || "jpg";
  const path = `${userId}/${uid()}.${ext}`;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const { error } = await supabase.storage
    .from("wardrobe")
    .upload(path, bytes, { contentType: mediaType, upsert: false });
  if (error) {
    console.error("[storage] upload failed, keeping inline image:", error);
    return dataUrl;
  }

  const { data } = supabase.storage.from("wardrobe").getPublicUrl(path);
  return data.publicUrl;
}
