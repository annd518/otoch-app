// Make your own avatar (optional): gender, skin, hair, beard, eyes, ...
// Saved on the server; customers see it on their order once you are assigned.
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { AvatarView } from "../components/AvatarView";
import { Button } from "../components/Button";
import { ErrorBox } from "../components/ErrorBox";
import { Surface } from "../components/Presentation";
import { theme } from "../design/theme";
import { fetchMyAvatar, saveMyAvatar } from "../services/avatar";
import { http } from "../services/http";
import {
  DEFAULT_AVATAR,
  SECTIONS,
  choicesFor,
  randomAvatar,
  withPart,
  type AvatarParts,
  type PartKey,
} from "../utils/avatarParts";

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: selected ? theme.color.brand : theme.color.border,
        backgroundColor: selected ? theme.color.brand : theme.color.surface,
      }}
    >
      <AppText
        variant="label"
        color={selected ? theme.color.onBrand : theme.color.text}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default function AvatarEditor() {
  const router = useRouter();
  // undefined = loading; the server's saved avatar (null = none yet)
  const [saved, setSaved] = useState<AvatarParts | null | undefined>(undefined);
  const [avatar, setAvatar] = useState<AvatarParts>(DEFAULT_AVATAR.female);
  const [section, setSection] = useState<PartKey>("skinColor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMyAvatar(http).then((r) => {
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

  const save = async (next: AvatarParts | null) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await saveMyAvatar(http, next);
    setBusy(false);
    if (!r.ok) setError(r.message);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const sections = SECTIONS.filter(
    (s) => s.key !== "facialHair" || avatar.gender === "male",
  );
  const current = sections.find((s) => s.key === section) ?? sections[0];
  const choices = choicesFor(current.key, avatar.gender);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <AppText variant="title">Аватар зохиох</AppText>
        {error ? <ErrorBox message={error} /> : null}
        {saved === undefined ? (
          <AppText color={theme.color.secondary}>Ачаалж байна…</AppText>
        ) : (
          <>
            <Surface style={{ alignItems: "center", gap: 12, padding: 16 }}>
              <AvatarView avatar={avatar} name="Таны" size={160} />
              <Button
                label="Санамсаргүй"
                variant="secondary"
                onPress={() => setAvatar(randomAvatar())}
              />
            </Surface>

            <AppText variant="label">Хүйс</AppText>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {(["female", "male"] as const).map((g) => (
                <Pill
                  key={g}
                  label={g === "female" ? "Эмэгтэй" : "Эрэгтэй"}
                  selected={avatar.gender === g}
                  onPress={() => setAvatar((a) => withPart(a, "gender", g))}
                />
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {sections.map((s) => (
                  <Pill
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

            <AppText variant="caption" color={theme.color.secondary}>
              Аватар заавал биш. Таныг томилогдсон захиалга дээр үйлчлүүлэгчид
              харагдана.
            </AppText>
            <Button
              label="Хадгалах"
              loading={busy}
              onPress={() => void save(avatar)}
            />
            {saved ? (
              <Button
                label="Аватар хасах"
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    "Аватар хасах",
                    "Аватараа хасах уу? Профайл зураг заавал биш.",
                    [
                      { text: "Болих", style: "cancel" },
                      { text: "Хасах", onPress: () => void save(null) },
                    ],
                  )
                }
              />
            ) : null}
            <Button
              label="Болих"
              variant="secondary"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(tabs)/profile")
              }
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
