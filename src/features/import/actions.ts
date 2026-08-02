"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/auth/guards";
import { hashPassword } from "@/auth/password";

import { DEFAULT_IMPORT_PASSWORD } from "./constants";
import { buildSingleEntityPlan } from "./plan";
import { runImport } from "./service";

export type UploadState = { error?: string; ok?: string };

const MAX_BYTES = 1_000_000; // 1 MB

/**
 * Manager CSV upload. Runs the file through the SAME importer as the seed
 * (`runImport`), auto-detecting whether it's a staff or shifts export, then
 * refreshes the report below.
 */
export async function uploadCsvAction(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  await requireManager();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File too large (max 1 MB)." };
  }

  const detected = buildSingleEntityPlan(await file.text());
  if (!detected) {
    return {
      error:
        "Unrecognized CSV. Expected a staff export (staff_id, email…) or a shifts export (shift_id, requirements…).",
    };
  }

  const passwordHash = await hashPassword(DEFAULT_IMPORT_PASSWORD);
  const { summary } = await runImport({
    plan: detected.plan,
    source: "upload",
    filename: file.name,
    defaultPasswordHash: passwordHash,
  });

  revalidatePath("/import");

  const entity = detected.kind === "staff" ? summary.staff : summary.shifts;
  const kept = entity.accepted + entity.repaired;
  return {
    ok: `Imported ${file.name}: ${kept} ${detected.kind} row${kept === 1 ? "" : "s"} (${entity.merged} merged, ${entity.rejected} rejected). See the report below.`,
  };
}
