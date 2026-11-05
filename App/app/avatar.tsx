// Make your own avatar (optional): gender, skin, hair, beard, eyes, ...
// Saved on the server, so it stays when the phone changes.
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Banner, Button, Card, Chip, Copy, Screen, StateView } from "@/components/ui";
import { AvatarView } from "@/components/AvatarView";
import { useSingleFlight } from "@/components/useSingleFlight";
import { apiService } from "@/services/api";
import { theme } from "@/design/theme";
import {
  DEFAULT_AVATAR,
  SECTIONS,
  choicesFor,
  randomAvatar,
  withPart,
  type AvatarParts,
  type PartKey,
} from "@/utils/avatarParts";

export default function AvatarEditor() {
  // undefined = loading; the server's saved avatar (null = none yet)
  const [saved, setSaved] = useState<AvatarParts | null | undefined>(undefined),
    [avatar, setAvatar] = useState<AvatarParts>(DEFAULT_AVATAR.female),
    [section, setSection] = useState<PartKey>("skinColor"),
    [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiService.getMyAvatar().then((r) => {
      if (!active) return;
      if (r.ok) {
        setSaved(r.data.avatar);
        if (r.data.avatar) setAvatar(r.data.avatar);
      } else {
        setSaved(null);
        setError(r.message);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const save = useSingleFlight(async (next: AvatarParts | null) => {
    setError("");
    const r = await apiService.saveMyAvatar(next);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  });

  const sections = SECTIONS.filter(
    (s) => s.key !== "facialHair" || avatar.gender === "male",
  );
  const current = sections.find((s) => s.key === section) ?? sections[0];
  const choices = choicesFor(current.key, avatar.gender);

  return (
    <Screen
      title="Аватар зохиох"
      footer={
        <>
          <Button
            title="Хадгалах"
            network
            busy={save.running}
            disabled={saved === undefined}
            onPress={() => void save.run(avatar)}
          />
          {!!saved && (
            <Button
              secondary
              variant="danger"
              title="Аватар хасах"
              disabled={save.running}
              onPress={() =>
                Alert.alert("Аватар хасах", "Аватараа хасах уу? Профайл зураг заавал биш.", [
                  { text: "Болих", style: "cancel" },
                  { text: "Хасах", onPress: () => void save.run(null) },
                ])
              }
            />
          )}
        </>
      }
    >
      {!!error && <Banner error>{error}</Banner>}
      {saved === undefined ? (
        <StateView title="Ачаалж байна" loading />
      ) : (
        <>
          <Card>
            <View style={{ alignItems: "center", gap: 12 }}>
              <AvatarView avatar={avatar} name="Таны" size={160} />
              <Button
                secondary
                variant="ghost"
                title="Санамсаргүй"
                onPress={() => setAvatar(randomAvatar())}
              />
            </View>
          </Card>

          <Copy variant="label">Хүйс</Copy>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {(["female", "male"] as const).map((g) => (
              <Chip
                key={g}
                label={g === "female" ? "Эмэгтэй" : "Эрэгтэй"}
                selected={avatar.gender === g}
                onPress={() => setAvatar((a) => withPart(a, "gender", g))}
                style={{ flex: 1, alignItems: "center" }}
              />
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
              {sections.map((s) => (
                <Chip
                  key={s.key}
                  label={s.title}
                  selected={current.key === s.key}
                  onPress={() => setSection(s.key)}
                />
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {choices.map((c) => {
              const selected = avatar[current.key] === c.value;
              return (
                <Pressable
                  key={c.value}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  accessibilityState={{ selected }}
                  onPress={() =>
                    setAvatar((a) => withPart(a, current.key, c.value))
                  }
                  style={{
                    padding: 3,
                    borderRadius: 40,
                    borderWidth: 3,
                    borderColor: selected ? theme.color.brand : "transparent",
                  }}
                >
                  {current.color ? (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: `#${c.value}`,
                        borderWidth: 1,
                        borderColor: theme.color.border,
                      }}
                    />
                  ) : (
                    <AvatarView
                      avatar={withPart(avatar, current.key, c.value)}
                      name={c.label}
                      size={64}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Copy variant="caption">
            Аватар заавал биш. Хүссэн үедээ өөрчилж эсвэл хасаж болно.
          </Copy>
        </>
      )}
    </Screen>
  );
}
