import React, { useCallback, useState } from "react";
import { Alert, Linking, Image, View, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import { storage } from "@/utils/storage";
import * as ImagePicker from "expo-image-picker";
import { getAvatar, saveAvatar, removeAvatar } from "@/utils/avatar";
import { draftStore } from "@/utils/draftStore";
import { theme } from "@/design/theme";
import { useSingleFlight } from "@/components/useSingleFlight";
import { SupportContactActions } from "@/components/SupportContactActions";
import { useBookingDraft } from "@/context/BookingDraftContext";
import type { AppUser, Parent } from "@/services/apiTypes";
import { Banner, Button, Card, Copy, Screen } from "@/components/ui";
export default function Profile() {
  const [user, setUser] = useState<AppUser | null>(null),
    [parents, setParents] = useState<Parent[]>([]),
    [message, setMessage] = useState(""),
    [avatar, setAvatar] = useState<string | null>(null);
  const { dispatch } = useBookingDraft();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void storage.getUser().then((u) => {
        if (!active) return;
        setUser(u);
        setAvatar(null);
        if (u)
          void getAvatar(u.id)
            .then((uri) => {
              if (active) setAvatar(uri);
            })
            .catch(() => {
              if (active) setMessage("Зургийг ачаалж чадсангүй.");
            });
      });
      void apiService.getParents().then((r) => {
        if (active) {
          if (r.ok) setParents(r.data);
          else setMessage(r.message);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );
  const chooseAvatar = useSingleFlight(async (action: "choose" | "remove") => {
    if (!user) return;
    setMessage("");
    try {
      if (action === "remove") {
        if ((await storage.getUser())?.id !== user.id) return;
        await removeAvatar(user.id);
        setAvatar(null);
        return;
      }
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setMessage("Зураг сонгохын тулд зургийн сангийн зөвшөөрөл өгнө үү.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: Platform.OS === "web",
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) {
        setMessage("5 MB хүртэлх зураг сонгоно уу.");
        return;
      }
      if ((await storage.getUser())?.id !== user.id) return;
      if (Platform.OS === "web" && !asset.base64) {
        setMessage("Зургийг хадгалах боломжгүй байна. Өөр зураг сонгоно уу.");
        return;
      }
      const source =
        Platform.OS === "web" && asset.base64
          ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
      setAvatar(await saveAvatar(user.id, source));
      setMessage("Таны зураг хадгалагдлаа.");
    } catch {
      setMessage("Зураг хадгалж чадсангүй. Дахин оролдоно уу.");
    }
  });
  const displayName =
    user?.email === "child@demo.com" && user.name === "Ramesh Kumar"
      ? "Б. Тэмүүлэн"
      : (user?.name ?? "Хэрэглэгч");
  const phone =
    user?.email === "child@demo.com"
      ? "99000001"
      : user?.email.match(/^976(\d{8})@phone\.otoch\.invalid$/)?.[1];
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => Array.from(part)[0])
    .slice(0, 2)
    .join("");
  const logout = async () => {
    await apiService.logout();
    // An unsaved booking must not stay on a device the user signed out of.
    // Cleared after the session ends, so a pending save cannot write it back.
    await draftStore.clear();
    dispatch({ type: "reset" });
    router.replace("/auth/phone");
  };
  const open = (url: string | undefined) => {
    if (!url?.startsWith("https://")) {
      setMessage("Батлагдсан холбоос хараахан тохируулагдаагүй байна.");
      return;
    }
    void Linking.openURL(url);
  };
  return (
    <Screen title="Нүүр хуудас" back={false}>
      <Card>
        <View style={{ alignItems: "center", gap: 12 }}>
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              accessibilityLabel="Таны аватар"
              style={{ width: 112, height: 112, borderRadius: 56 }}
              onError={() => {
                setAvatar(null);
                setMessage("Зургийг харуулж чадсангүй. Дахин сонгоно уу.");
              }}
            />
          ) : (
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: theme.color.surface,
                ...theme.depth.raised,
                borderWidth: 2,
                borderColor: theme.color.background,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Copy variant="title">{initials}</Copy>
            </View>
          )}
          <Copy variant="heading">{displayName}</Copy>
        </View>
        <Button
          secondary
          title={avatar ? "Зураг солих" : "Өөрийн зураг сонгох"}
          disabled={!user}
          busy={chooseAvatar.running}
          onPress={() => {
            void chooseAvatar.run("choose");
          }}
        />
        <Copy variant="caption">Зураг энэ төхөөрөмжид хадгалагдана.</Copy>
        {avatar && (
          <Button
            secondary
            title="Зураг хасах"
            disabled={chooseAvatar.running}
            onPress={() => {
              if (!user) return;
              Alert.alert("Зураг хасах", "Аватарын зургийг хасах уу?", [
                { text: "Болих", style: "cancel" },
                {
                  text: "Хасах",
                  onPress: () => {
                    void chooseAvatar.run("remove");
                  },
                },
              ]);
            }}
          />
        )}
        {phone && <Copy>Утас: +976 {phone}</Copy>}
        {user?.email === "child@demo.com" && <Copy>Улаанбаатар хот</Copy>}
        <Button
          secondary
          title="Миний мэдээлэл засах"
          onPress={() => router.push("/auth/profile")}
        />
        {user?.email && !user.email.endsWith(".invalid") && (
          <Copy>{user.email}</Copy>
        )}
      </Card>
      {!!message && <Banner>{message}</Banner>}
      <Copy variant="heading">Үйлчлүүлэгчид</Copy>
      {parents.map((p) => (
        <Card key={p.id}>
          <Copy>
            {user?.email === "child@demo.com"
              ? ((
                  {
                    "Anita Sharma": "Д. Цэцэг",
                    "Hari Sharma": "Б. Бат",
                  } as Record<string, string>
                )[p.name] ?? p.name)
              : p.name}
          </Copy>
          <Button
            secondary
            title="Мэдээлэл засах"
            onPress={() =>
              router.push({
                pathname: "/patients/edit",
                params: { id: p.id },
              })
            }
          />
        </Card>
      ))}
      <Button
        title="Үйлчлүүлэгч нэмэх"
        onPress={() => router.push("/patients/edit")}
      />
      <Button
        secondary
        title="Миний захиалгууд"
        onPress={() => router.push("/(tabs)/orders")}
      />
      <Button
        secondary
        variant="ghost"
        title="Үйлчилгээний нөхцөл"
        onPress={() => open(process.env.EXPO_PUBLIC_TERMS_URL)}
      />
      <Button
        secondary
        variant="ghost"
        title="Нууцлалын бодлого"
        onPress={() => open(process.env.EXPO_PUBLIC_PRIVACY_URL)}
      />
      <SupportContactActions />
      <Button
        secondary
        variant="danger"
        title="Данс устгах хүсэлт"
        onPress={() =>
          Alert.alert(
            "Данс устгах хүсэлт",
            "Хүсэлтийг бүртгэж, хадгалалтын шаардлагын дагуу шийдвэрлэнэ. Одоо шууд өгөгдөл устгахгүй.",
            [
              { text: "Болих", style: "cancel" },
              {
                text: "Хүсэлт илгээх",
                style: "destructive",
                onPress: () => {
                  void apiService
                    .deleteAccount()
                    .then((r) =>
                      setMessage(
                        r.ok ? "Данс устгах хүсэлт бүртгэгдлээ." : r.message,
                      ),
                    );
                },
              },
            ],
          )
        }
      />
      <Button
        secondary
        title="Гарах"
        onPress={() =>
          Alert.alert("Гарах", "Системээс гарах уу?", [
            { text: "Болих", style: "cancel" },
            {
              text: "Гарах",
              onPress: () => {
                void logout();
              },
            },
          ])
        }
      />
    </Screen>
  );
}
