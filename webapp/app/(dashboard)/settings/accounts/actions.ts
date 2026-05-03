"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCOUNT_COLORS } from "@cctm/shared";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UpdateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function updateAccountAction(formData: FormData): Promise<void> {
  const session = await auth();
  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    label: formData.get("label"),
    color: formData.get("color"),
  });
  if (!parsed.success) return;
  if (!ACCOUNT_COLORS.includes(parsed.data.color)) return;

  await prisma.account.updateMany({
    where: { id: parsed.data.id },
    data: { label: parsed.data.label, color: parsed.data.color },
  });
  revalidatePath("/settings/accounts");
}
