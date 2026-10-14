import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Polygon, type Details, type Region } from "react-native-maps";
import { MapPin } from "lucide-react-native";

import { Banner, Button, Copy, Input } from "@/components/ui";
import { theme as t } from "@/design/theme";
import {
  initialRegion,
  isInside,
  roundPoint,
  type LatLng,
  type ZoneBounds,
} from "@/utils/geo";

type ZoneLike = { id: string; name: string; bounds?: ZoneBounds | null };

const corners = (b: ZoneBounds) => [
  { latitude: b.minLat, longitude: b.minLng },
  { latitude: b.minLat, longitude: b.maxLng },
  { latitude: b.maxLat, longitude: b.maxLng },
  { latitude: b.maxLat, longitude: b.minLng },
];

const parseCoord = (value: string) =>
  value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;

// Address point picker: the user pans the map under a fixed centre pin.
// Only a user gesture sets the point, so an untouched map never submits the
// default city centre. No device GPS is used (see docs/release/privacy-policy-draft.md).
// Manual coordinate entry stays available as a fallback.
export function LocationPicker({
  value,
  zones,
  selectedZoneId,
  onChange,
}: {
  value: Partial<LatLng>;
  zones: ZoneLike[];
  selectedZoneId?: string;
  onChange: (point: Partial<LatLng>) => void;
}) {
  const selected = zones.find((z) => z.id === selectedZoneId) ?? null;
  const [region] = useState(() => initialRegion(value, selected?.bounds));
  const [manual, setManual] = useState(false);
  const touched = useRef(false);
  const map = useRef<MapView>(null);
  // Map centre right now (the pin tip), whether or not a gesture was detected
  const center = useRef<LatLng>({ lat: region.latitude, lng: region.longitude });

  const hasPoint =
    typeof value.lat === "number" && typeof value.lng === "number";
  const outside =
    hasPoint && !!selected?.bounds && !isInside(selected.bounds, value as LatLng);

  const onRegionChangeComplete = (r: Region, details?: Details) => {
    center.current = { lat: r.latitude, lng: r.longitude };
    // Auto-commit only after a real user gesture. Apple Maps (iOS) may not
    // report touches to JS, so the "use this point" button below always works.
    if (!touched.current && !details?.isGesture) return;
    onChange(roundPoint(center.current));
  };
  const confirmCenter = () => onChange(roundPoint(center.current));

  const setManualCoord = (patch: Partial<LatLng>) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (typeof next.lat === "number" && typeof next.lng === "number")
      map.current?.animateCamera({
        center: { latitude: next.lat, longitude: next.lng },
      });
  };

  return (
    <View style={{ gap: t.space[1] }}>
      <Copy variant="label">Хаягаа газрын зураг дээр тэмдэглэнэ үү</Copy>
      <Copy variant="caption" style={{ color: t.color.secondary }}>
        Газрын зургийг хөдөлгөж, улаан тэмдгийг байрныхаа дээр тааруулна.
      </Copy>
      <View
        style={styles.mapBox}
        onTouchStart={() => {
          touched.current = true;
        }}
      >
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={onRegionChangeComplete}
          onPanDrag={() => {
            touched.current = true;
          }}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          accessibilityLabel="Хаяг сонгох газрын зураг"
        >
          {zones.map((z) =>
            z.bounds ? (
              <Polygon
                key={z.id}
                coordinates={corners(z.bounds)}
                strokeWidth={2}
                strokeColor={
                  z.id === selectedZoneId ? t.color.brand : t.color.disabled
                }
                fillColor={
                  z.id === selectedZoneId
                    ? "rgba(17, 88, 159, 0.08)"
                    : "rgba(114, 131, 154, 0.05)"
                }
              />
            ) : null,
          )}
        </MapView>
        <View pointerEvents="none" style={styles.pin}>
          <MapPin size={40} color={t.color.error} fill={t.color.background} />
        </View>
      </View>
      <Button
        title={hasPoint ? "Улаан тэмдгийн цэгээр шинэчлэх" : "Энэ цэгийг хаяг болгох"}
        onPress={confirmCenter}
      />
      <Copy variant="caption" style={{ color: t.color.secondary }}>
        {hasPoint
          ? `Сонгосон цэг: ${value.lat!.toFixed(5)}, ${value.lng!.toFixed(5)}`
          : "Цэг сонгоогүй байна: улаан тэмдгийг байрандаа тааруулаад дээрх товчийг дарна уу."}
      </Copy>
      {outside && (
        <Banner error>
          {`Сонгосон цэг "${selected!.name}" бүсээс гадна байна. Цэгээ засах эсвэл өөр бүс сонгоно уу.`}
        </Banner>
      )}
      <Button
        secondary
        title={manual ? "Гараар оруулахыг хаах" : "Координат гараар оруулах"}
        onPress={() => setManual((m) => !m)}
      />
      {manual && (
        <>
          <Input
            label="Өргөрөг"
            keyboardType="decimal-pad"
            value={value.lat?.toString() ?? ""}
            onChangeText={(v) => setManualCoord({ lat: parseCoord(v) })}
          />
          <Input
            label="Уртраг"
            keyboardType="decimal-pad"
            value={value.lng?.toString() ?? ""}
            onChangeText={(v) => setManualCoord({ lng: parseCoord(v) })}
          />
        </>
      )}
    </View>
  );
}

const PIN = 40;
const styles = StyleSheet.create({
  mapBox: {
    height: 280,
    borderRadius: t.radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.muted,
  },
  // The pin's tip (bottom centre) marks the map centre
  pin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -PIN / 2,
    marginTop: -PIN,
  },
});
