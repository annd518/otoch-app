import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import { storage } from "@/utils/storage";
import { useSingleFlight } from "@/components/useSingleFlight";
import { Banner, Button, Copy, Input, Screen } from "@/components/ui";
export default function PhoneAuth() {
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [challenge, setChallenge] = useState<{
      challengeId: string;
      expiresAt: string;
      isMock: boolean;
      testCode?: string;
    } | null>(null),
    [resendAt, setResendAt] = useState(0),
    [now, setNow] = useState(() => Date.now()),
    [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const request = useSingleFlight(async () => {
    setError("");
    const r = await apiService.requestOtp(`+976${phone}`);
    if (r.ok) {
      setChallenge(r.data);
      setResendAt(Date.now() + 60000);
      setCode("");
    } else setError(r.message);
  });
  const verify = useSingleFlight(async () => {
    if (!challenge) return;
    setError("");
    const r = await apiService.verifyOtp(
      `+976${phone}`,
      challenge.challengeId,
      code,
      name || undefined,
    );
    if (!r.ok) {
      setError(r.message);
      return;
    }
    await storage.saveSession(r.data);
    router.replace(
      r.data.user.name === "Хэрэглэгч" ? "/auth/profile" : "/(tabs)",
    );
  });
  return (
    <Screen title="OTOCH-д нэвтрэх">
      {expired === "1" && (
        <Banner>Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.</Banner>
      )}
      <Copy>Утасны дугаараа баталгаажуулна уу.</Copy>
      {!!error && <Banner error>{error}</Banner>}
      <Input
        label="Утасны дугаар · +976"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        value={phone}
        editable={!challenge}
        maxLength={8}
        onChangeText={(value) => setPhone(value.replace(/\D/g, ""))}
      />
      {!challenge ? (
        <Button
          network
          title="Код авах"
          disabled={!/^\d{8}$/.test(phone)}
          busy={request.running}
          onPress={() => {
            void request.run();
          }}
        />
      ) : (
        <>
          {challenge.isMock && (
            <Banner>
              SMS туршилтын горим.{" "}
              {challenge.testCode
                ? `Тест код: ${challenge.testCode}`
                : "Бодит SMS илгээгээгүй."}
            </Banner>
          )}
          <Input
            label="6 оронтой код"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
            maxLength={6}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
          <Input
            label="Нэр (анхны бүртгэлд)"
            value={name}
            onChangeText={setName}
          />
          <Button
            title="Баталгаажуулах"
            disabled={
              !/^\d{6}$/.test(code) || Date.parse(challenge.expiresAt) <= now
            }
            busy={verify.running}
            onPress={() => {
              void verify.run();
            }}
          />
          <Button
            secondary
            title={
              now < resendAt
                ? `Дахин илгээх · ${Math.ceil((resendAt - now) / 1000)} сек`
                : "Код дахин илгээх"
            }
            disabled={now < resendAt}
            busy={request.running}
            onPress={() => {
              void request.run();
            }}
          />
          <Button
            secondary
            title="Утасны дугаар солих"
            onPress={() => {
              setChallenge(null);
              setCode("");
            }}
          />
        </>
      )}
      <Button
        secondary
        title="Имэйлээр нэвтрэх"
        onPress={() => router.push("/auth/login")}
      />
    </Screen>
  );
}
