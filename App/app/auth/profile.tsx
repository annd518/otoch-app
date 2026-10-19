import { UserRound } from "lucide-react-native";
import { FeatureSummary, Banner, Button, Input, Screen } from "@/components/ui";
import { useState } from "react";
import { router } from "expo-router";
import { apiService } from "@/services/api";
import { storage } from "@/utils/storage";
import { useSingleFlight } from "@/components/useSingleFlight";
export default function InitialProfile() {
  const [name, setName] = useState(""),
    [error, setError] = useState("");
  const save = useSingleFlight(async () => {
    const r = await apiService.updateProfile(name.trim());
    if (!r.ok) {
      setError(r.message);
      return;
    }
    const token = await storage.getAuthToken();
    if (!token) {
      router.replace("/auth/phone");
      return;
    }
    await storage.saveSession({ token, user: r.data });
    router.replace("/(tabs)");
  });
  return (
    <Screen title="Таны мэдээлэл" back={false}>
      <FeatureSummary
        icon={UserRound}
        title="Танилцъя"
        description="Үйлчилгээнд ашиглах нэрээ оруулна уу."
      />
      {!!error && <Banner error>{error}</Banner>}
      <Input label="Нэр" value={name} onChangeText={setName} />
      <Button
        network
        title="Хадгалах"
        disabled={name.trim().length < 2}
        busy={save.running}
        onPress={() => {
          void save.run();
        }}
      />
    </Screen>
  );
}
