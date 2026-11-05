import { useMemo } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";

import { AppText } from "./AppText";
import { theme } from "../design/theme";
import { diceBearOptions, type AvatarParts } from "../utils/avatarParts";

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => Array.from(part)[0] ?? "")
    .slice(0, 2)
    .join("");

/** The nurse's self-made avatar, else their initials (an avatar is optional). */
export function AvatarView({
  avatar,
  name,
  size = 96,
}: {
  avatar?: AvatarParts | null;
  name: string;
  size?: number;
}) {
  const xml = useMemo(
    () =>
      avatar
        ? createAvatar(
            avataaars,
            diceBearOptions(avatar) as Partial<avataaars.Options>,
          ).toString()
        : null,
    [avatar],
  );
  const round = { width: size, height: size, borderRadius: size / 2 };
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
        borderWidth: 1,
        borderColor: theme.color.border,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <AppText variant={size >= 80 ? "title" : "label"}>{initialsOf(name)}</AppText>
    </View>
  );
}
