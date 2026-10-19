import { TaskBody, Intro } from "../../../components/Presentation";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { ErrorBox } from "../../../components/ErrorBox";
import { Field } from "../../../components/Field";
import { theme } from "../../../design/theme";
import { useOrder } from "../../../hooks/useOrder";
import { http } from "../../../services/http";
import { reportIncident } from "../../../services/nurseVisit";
import { EMERGENCY_NUMBER, telUrl } from "../../../utils/visitRecord";

export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { order, busy, load, run } = useOrder(id);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submit() {
    setMessage(null);
    const outcome = await run((o) =>
      reportIncident(http, o.id, {
        version: o.version,
        description: description.trim(),
      }),
    );
    if (outcome.ok) router.replace("/");
    else setMessage(outcome.message);
  }

  function confirm() {
    Alert.alert(
      "Осол бүртгэх үү?",
      "Админд мэдэгдэж, захиалга «Осол» төлөвт орно.",
      [
        { text: "Болих", style: "cancel" },
        { text: "Бүртгэх", style: "destructive", onPress: () => void submit() },
      ],
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.color.background }}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Осол бүртгэх",
          headerBackTitle: "Буцах",
        }}
      />
      <TaskBody
        footer={
          <Button
            label="Осол бүртгэх"
            variant="secondary"
            loading={busy}
            disabled={description.trim().length < 3 || !order}
            onPress={confirm}
          />
        }
      >
        <Intro
          title="Аюулгүй байдлын мэдэгдэл"
          description="Яаралтай тусламж болон ослын бүртгэл."
        />
        <AppText color={theme.color.secondary}>
          Аюултай байдал үүссэн бол эхлээд {EMERGENCY_NUMBER} руу залгана уу.
          Апп яаралтай тусламж үзүүлэхгүй.
        </AppText>
        <Button
          label={`${EMERGENCY_NUMBER} руу залгах`}
          onPress={() => void Linking.openURL(telUrl(EMERGENCY_NUMBER))}
        />
        <Field
          label={`Юу болсон бэ?${order ? ` (${order.patientName})` : ""}`}
          multiline
          maxLength={1000}
          textAlignVertical="top"
          style={{ minHeight: 140 }}
          value={description}
          onChangeText={setDescription}
        />
        {message ? <ErrorBox message={message} /> : null}
      </TaskBody>
    </SafeAreaView>
  );
}
