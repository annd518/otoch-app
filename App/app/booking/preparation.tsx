import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { Catalog } from "@/services/apiTypes";
import { apiService } from "@/services/api";
import { useBookingDraft } from "@/context/BookingDraftContext";
import {
  Banner,
  Button,
  Card,
  Chip,
  Copy,
  Screen,
  StateView,
} from "@/components/ui";
export default function Preparation() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { dispatch, state } = useBookingDraft();
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [checked, setChecked] = useState<string[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiService.getCatalog().then((r) => {
      if (!active) return;
      if (r.ok) setCatalog(r.data);
      else setError(r.message);
    });
    return () => {
      active = false;
    };
  }, []);
  const service = catalog?.services.find((s) => s.code === code);
  const preparation = service?.preparation ?? [];
  return (
    <Screen title="Үйлчилгээний бэлтгэл">
      {!!error && <Banner error>{error}</Banner>}
      {!service ? (
        <StateView title="Бэлтгэл ачаалж байна" loading={!error} />
      ) : (
        <>
          <Card>
            <Copy variant="heading">{service.name}</Copy>
            <Copy>Та бэлдэнэ</Copy>
            {preparation.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={checked.includes(item)}
                onPress={() =>
                  setChecked((list) =>
                    list.includes(item)
                      ? list.filter((v) => v !== item)
                      : [...list, item],
                  )
                }
              />
            ))}
            {!preparation.length && (
              <Copy>Бэлтгэлийн дэлгэрэнгүй серверт ороогүй байна.</Copy>
            )}
          </Card>
          {!!service.nurseSupplies?.length && (
            <Card>
              <Copy variant="heading">Сувилагч авчирна</Copy>
              {service.nurseSupplies.map((item) => (
                <Copy key={item}>• {item}</Copy>
              ))}
            </Card>
          )}
          {service.isFixture && (
            <Banner>
              Бэлтгэлийн агуулга батлагдаагүй, туршилтын хувилбар.
            </Banner>
          )}
          <Button
            title="Захиалгаа эхлүүлэх"
            disabled={preparation.some((item) => !checked.includes(item))}
            onPress={() => {
              if (state.server && state.server.status !== "DRAFT")
                dispatch({ type: "reset" });
              dispatch({
                type: "selectService",
                service,
                catalogVersion: catalog?.catalogVersion ?? null,
                source: apiService.sourceOf("catalog"),
              });
              router.push("/(tabs)/bookappointment");
            }}
          />
        </>
      )}
    </Screen>
  );
}
