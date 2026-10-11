import React, { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import type { Catalog } from "@/services/apiTypes";
import { groups } from "@/design/catalog";
import { formatMnt } from "@/utils/money";
import { Banner, Button, Card, Copy, Screen, StateView } from "@/components/ui";
export default function CatalogScreen() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiService.getCatalog();
    setLoading(false);
    if (result.ok) {
      setCatalog(result.data);
      setError("");
    } else setError(result.message);
  }, []);
  useEffect(() => {
    let active = true;
    void apiService.getCatalog().then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.ok) {
        setCatalog(result.data);
        setError("");
      } else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, []);
  const services =
    catalog?.services.filter(
      (s) =>
        s.isActive &&
        (s.group !== undefined ||
          !catalog?.services.some((item) => item.group !== undefined)) &&
        (!group || (s.group ?? s.category) === group),
    ) ?? [];
  return (
    <Screen title={groups.find((g) => g.code === group)?.title ?? "Үйлчилгээ"}>
      {loading ? (
        <StateView title="Үйлчилгээ ачаалж байна" loading />
      ) : error ? (
        <StateView
          title="Каталогийг ачаалж чадсангүй"
          message={error}
          action="Дахин оролдох"
          onAction={() => {
            void load();
          }}
        />
      ) : (
        <>
          {catalog?.containsFixtures && (
            <Banner>
              Туршилтын каталог. Үнэ болон агуулга эцэслэн батлагдаагүй.
            </Banner>
          )}
          {!group &&
            groups.map((g) => (
              <Button
                key={g.code}
                secondary
                title={g.title}
                onPress={() => router.setParams({ group: g.code })}
              />
            ))}
          {services.map((s) => (
            <Card key={s.id}>
              <Copy variant="heading">{s.name}</Copy>
              <Copy>
                {s.durationMin} минут · {formatMnt(s.priceMnt)}
              </Copy>
              <Button
                title="Дэлгэрэнгүй"
                onPress={() =>
                  router.push({
                    pathname: "/booking/service",
                    params: { code: s.code },
                  })
                }
              />
            </Card>
          ))}
          {!services.length && (
            <StateView
              title="Үйлчилгээ одоогоор алга"
              message="Энэ бүлгийн каталог серверт хараахан ороогүй байна."
            />
          )}
        </>
      )}
    </Screen>
  );
}
