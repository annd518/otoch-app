import React, { useMemo } from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";
import { theme } from "@/design/theme";
import { Copy } from "@/components/ui";
import { diceBearOptions, type AvatarParts } from "@/utils/avatarParts";

export function avatarSvg(avatar: AvatarParts): string {
  return createAvatar(
    avataaars,
    diceBearOptions(avatar) as Partial<avataaars.Options>,
  ).toString();
}

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => Array.from(part)[0] ?? "")
    .slice(0, 2)
    .join("");

/**
 * A round picture of a person: their photo, else their self-made avatar,
 * else their initials. Both the photo and the avatar are optional.
 */
export function AvatarView({
  avatar,
  photoUri,
  name,
  size = 112,
  onPhotoError,
}: {
  avatar?: AvatarParts | null;
  photoUri?: string | null;
  name: string;
  size?: number;
  onPhotoError?: () => void;
}) {
  const xml = useMemo(() => (avatar ? avatarSvg(avatar) : null), [avatar]);
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photoUri)
    return (
      <Image
        source={{ uri: photoUri }}
        accessibilityLabel={`${name}: зураг`}
        style={round}
        onError={onPhotoError}
      />
    );
  if (xml)
    return (
      <View accessible accessibilityLabel={`${name}: аватар`} style={round}>
        <SvgXml xml={xml} width={size} height={size} />
      </View>
    );
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={{
        ...round,
        backgroundColor: theme.color.surface,
        ...theme.depth.raised,
        borderWidth: 2,
        borderColor: theme.color.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Copy variant={size >= 80 ? "title" : "label"}>{initialsOf(name)}</Copy>
    </View>
  );
}
