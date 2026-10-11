import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import type { CatalogService } from "@/services/apiTypes";
import { formatMnt } from "@/utils/money";
import { Banner, Button, Card, Copy, Screen, StateView } from "@/components/ui";
export default function ServiceScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [service, setService] = useState<CatalogService | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiService.getCatalog().then((r) => {
      if (!active) return;
      if (r.ok) {
        setService(r.data.services.find((s) => s.code === code) ?? null);
      } else setError(r.message);
    });
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <Screen title={service?.name ?? "Үйлчилгээ"}>
      {!service ? (
        <StateView title={error || "Үйлчилгээ ачаалж байна"} loading={!error} />
      ) : (
        <>
          {service.isFixture && (
            <Banner>
              Эх баримтаас оруулсан туршилтын агуулга. Эмнэлзүйн баталгаа
              хүлээгдэж байна.
            </Banner>
          )}
          <Copy>{service.description}</Copy>
          {[
            ["Багтана", service.includes],
            ["Бэлдэнэ", service.preparation],
            ["Хийхгүй", service.exclusions],
          ].map(([title, lines]) => (
            <Card key={String(title)}>
              <Copy variant="heading">{String(title)}</Copy>
              {Array.isArray(lines) && lines.length ? (
                lines.map((line) => <Copy key={line}>• {line}</Copy>)
              ) : (
                <Copy>Дэлгэрэнгүй мэдээлэл серверт хараахан ороогүй.</Copy>
              )}
            </Card>
          ))}
          <Card>
            <Copy variant="heading">Үнэ</Copy>
            <Copy>
              {formatMnt(service.priceMnt)} · {service.durationMin} минут
            </Copy>
            <Copy>
              Эцсийн төлөх дүнг серверийн үнийн саналаар баталгаажуулна.
            </Copy>
          </Card>
          <Button
            title="Бэлтгэл харах"
            onPress={() =>
              router.push({
                pathname: "/booking/preparation",
                params: { code: service.code },
              })
            }
          />
        </>
      )}
    </Screen>
  );
}
