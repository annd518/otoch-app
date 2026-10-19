import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { storage } from "@/utils/storage";
import { Banner, Button, Card, Copy, Screen } from "@/components/ui";
export default function Onboarding() {
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    void storage.getValidSession().then((s) => {
      if (active && s) router.replace("/(tabs)");
    });
    return () => {
      active = false;
    };
  }, []);
  const slides = [
    {
      title: "Сувилахуйн тусламжийг гэртээ",
      text: "Өөрт тохирох үйлчилгээг сонгож, хаяг болон цагаа захиалаарай.",
    },
    {
      title: "Аюулгүй байдлаа эхэлж шалгана",
      text: "Эмчийн заалт, зөвшөөрөл, аюулын шинжийн асуулга нь үйлчилгээний өмнөх шалгалт юм.",
    },
    {
      title: "Захиалгын явцаа хянаарай",
      text: "Захиалга, төлбөр, баталгаажсан тэмдэглэлээ нэг дороос харна.",
    },
  ];
  return (
    <Screen title="OTOCH" back={false} logo>
      <Card>
        <Copy variant="heading">{slides[page].title}</Copy>
        <Copy>{slides[page].text}</Copy>
        <Copy>{page + 1} / 3</Copy>
      </Card>
      <Banner>Яаралтай тусламж шаардлагатай үед 103 руу залгана уу.</Banner>
      <Button
        title={page < 2 ? "Үргэлжлүүлэх" : "Эхлэх"}
        onPress={() =>
          page < 2 ? setPage((p) => p + 1) : router.push("/auth/phone")
        }
      />
      <Button
        secondary
        title="Алгасах"
        onPress={() => router.push("/auth/phone")}
      />
    </Screen>
  );
}
