import { z } from "zod";

// A self-made avatar is a small set of named parts the apps draw on the
// device (DiceBear "avataaars"); the server keeps the choice, never an image.
// Part values are the drawing library's names (e.g. "shortFlat", "d08b5b"),
// so only their shape is checked here; "none" means the part is left out.
const part = z.string().regex(/^[A-Za-z0-9]{1,40}$/);

export const avatarSchema = z
  .object({
    v: z.literal(1),
    gender: z.enum(["female", "male"]),
    skinColor: part,
    top: part,
    hairColor: part,
    facialHair: part,
    eyes: part,
    eyebrows: part,
    mouth: part,
    accessories: part,
    clothing: part,
    clothesColor: part,
    backgroundColor: part,
  })
  .strict();

export type Avatar = z.infer<typeof avatarSchema>;

/** A stored value that no longer matches the schema is shown as no avatar. */
export const readAvatar = (value: unknown): Avatar | null => {
  const parsed = avatarSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
