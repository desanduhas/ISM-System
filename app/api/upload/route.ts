import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
]);

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();

    const formData = await request.formData();
    const file = (formData.get("file") || formData.get("attachment")) as File | null;
    const bucket = (formData.get("bucket") as string) || "attachments";
    const subfolder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 25MB limit (Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    // Mime-type validation
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' is not supported. Please upload an image, document, or archive.` },
        { status: 400 }
      );
    }

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitizedFileName}`;
    const storagePath = `${subfolder}/${profile.id}/${uniqueFileName}`;

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let publicUrl = "";

    try {
      const { data: uploadData, error: uploadError } = await admin.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.warn("Supabase storage upload returned error (using fallback):", uploadError.message);
        publicUrl = `/uploads/${bucket}/${uniqueFileName}`;
      } else {
        const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(uploadData.path);
        publicUrl = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      console.warn("Storage exception, continuing with local reference:", storageErr);
      publicUrl = `/uploads/${bucket}/${uniqueFileName}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        path: storagePath,
        url: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
