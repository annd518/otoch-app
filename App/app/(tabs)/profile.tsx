import React, { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import { storage } from "@/utils/storage";
import { useBookingDraft } from "@/context/BookingDraftContext";
import type { AppUser, Parent } from "@/services/apiTypes";
import { Banner, Button, Card, Copy, Screen } from "@/components/ui";
export default function Profile() {
  const [user, setUser] = useState<AppUser | null>(null),
    [parents, setParents] = useState<Parent[]>([]),
    [message, setMessage] = useState("");
  const { dispatch } = useBookingDraft();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void storage.getUser().then((u) => {
        if (active) setUser(u);
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
  const logout = async () => {
    await apiService.logout();
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
    <Screen title="Профайл" back={false}>
      <Card>
        <Copy variant="heading">{user?.name ?? "Хэрэглэгч"}</Copy>
        {user?.email && !user.email.endsWith(".invalid") && (
          <Copy>{user.email}</Copy>
        )}
      </Card>
      {!!message && <Banner>{message}</Banner>}
      <Copy variant="heading">Үйлчлүүлэгчид</Copy>
      {parents.map((p) => (
        <Card key={p.id}>
          <Copy>{p.name}</Copy>
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
        title="Үйлчилгээний нөхцөл"
        onPress={() => open(process.env.EXPO_PUBLIC_TERMS_URL)}
      />
      <Button
        secondary
        title="Нууцлалын бодлого"
        onPress={() => open(process.env.EXPO_PUBLIC_PRIVACY_URL)}
      />
      <Button
        secondary
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
