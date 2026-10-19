import { View } from "react-native";
import { HeartPulse, Clock } from "lucide-react-native";
import {
  SectionHeading,
  FeatureSummary,
  careIcon,
  Banner,
  Button,
  Card,
  Copy,
  Screen,
  StateView,
} from "@/components/ui";
import { onboardingVisual as v } from "@/design/onboardingVisual";
import React, {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { router, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import type { Catalog } from "@/services/apiTypes";
import { groups } from "@/design/catalog";
import { formatMnt } from "@/utils/money";
const subscribeHydration = () => () => {};

export default function CatalogScreen() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // Static export has no query string; keep the first hydration title identical.
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const screenTitle = hydrated
    ? (groups.find((g) => g.code === group)?.title ?? "Үйлчилгээ")
    : "Үйлчилгээ";
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
    <Screen title={screenTitle}>
      <FeatureSummary
        icon={HeartPulse}
        title="Танд тохирох тусламж"
        description="Үйлчилгээний бэлтгэл, нөхцөл болон үнийг шалгаад сонгоорой."
      />
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
              <SectionHeading
                icon={careIcon(s.group ?? s.category)}
                title={s.name}
              />
              <View style={{ gap: 8 }}>
                <Copy variant="title" style={{ color: v.deep, fontSize: 24 }}>
                  {formatMnt(s.priceMnt)}
                </Copy>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Clock size={16} color={v.muted} />
                  <Copy variant="caption">{s.durationMin} минут</Copy>
                </View>
              </View>
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
