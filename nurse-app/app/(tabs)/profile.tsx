import { UserRound, BadgeCheck } from "lucide-react-native";
import {
  BrandHeader,
  Intro,
  Surface,
  FormSection,
} from "../../components/Presentation";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { ErrorBox } from "../../components/ErrorBox";
import { useSession } from "../../context/SessionContext";
import { theme } from "../../design/theme";
import { useProfile } from "../../hooks/useProfile";
import { formatUbDate } from "../../utils/orderView";

const STATUS_LABEL = {
  PENDING: "Баталгаажуулалт хүлээгдэж байна",
  VERIFIED: "Баталгаажсан",
  SUSPENDED: "Түр хаагдсан",
} as const;

export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const { profile, error, busy, load, toggle } = useProfile();

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const p = profile ?? null;
  const canToggle = p !== null && (p.isActive || p.blocker === null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        <BrandHeader />
        <Surface>
          <Intro
            title={user?.name ?? "Профайл"}
            description={user?.email}
            icon={UserRound}
          />
        </Surface>
        {error ? <ErrorBox message={error} /> : null}

        {profile === undefined ? null : p === null ? (
          <AppText color={theme.color.warning}>
            Таны бүртгэл админаар баталгаажаагүй байна. Компанитай холбогдоно
            уу.
          </AppText>
        ) : (
          <>
            <Surface
              style={{
                gap: theme.space[1],
                padding: theme.space[3],
                borderRadius: theme.radius.card,
                borderWidth: 1,
                borderColor: theme.color.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: theme.space[2],
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="label">Дуудлага хүлээн авах</AppText>
                  <AppText variant="caption" color={theme.color.secondary}>
                    {p.isActive
                      ? "Идэвхтэй: шинэ дуудлага танд ирнэ"
                      : (p.blocker ?? "Идэвхгүй: дуудлага ирэхгүй")}
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel="Дуудлага хүлээн авах"
                  value={p.isActive}
                  disabled={busy || !canToggle}
                  onValueChange={(v) => void toggle(v)}
                  trackColor={{ true: theme.color.brand }}
                />
              </View>
            </Surface>

            <FormSection title="Мэргэжлийн мэдээлэл">
              <Intro title="Бүртгэл, зөвшөөрөл" icon={BadgeCheck} />
              <AppText variant="caption" color={theme.color.secondary}>
                Бүртгэл: {STATUS_LABEL[p.status]}
              </AppText>
              {p.licenseNo ? (
                <AppText variant="caption" color={theme.color.secondary}>
                  Зөвшөөрөл №{p.licenseNo}
                  {p.licenseExpiresAt
                    ? ` · ${formatUbDate(p.licenseExpiresAt) ?? ""} хүртэл`
                    : ""}
                </AppText>
              ) : null}
              {p.skillTags.length > 0 ? (
                <AppText variant="caption" color={theme.color.secondary}>
                  Ур чадвар: {p.skillTags.join(", ")}
                </AppText>
              ) : null}
            </FormSection>
          </>
        )}

        <Button
          label="Гарах"
          variant="secondary"
          onPress={() => void signOut()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
