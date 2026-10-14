import { View } from "react-native";
import { Copy, Input, Banner } from "@/components/ui";
import { isInside, type LatLng, type ZoneBounds } from "@/utils/geo";
// Native maps are not supported by react-native-web. Keep the existing
// manual fallback without importing native map code into the web bundle.
export function LocationPicker({
  value,
  zones,
  selectedZoneId,
  onChange,
}: {
  value: Partial<LatLng>;
  zones: { id: string; name: string; bounds?: ZoneBounds | null }[];
  selectedZoneId?: string;
  onChange: (point: Partial<LatLng>) => void;
}) {
  const zone = zones.find((z) => z.id === selectedZoneId);
  const outside =
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    zone?.bounds &&
    !isInside(zone.bounds, value as LatLng);
  const coordinate = (raw: string) =>
    raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  return (
    <View style={{ gap: 12 }}>
      <Copy variant="label">Байршил</Copy>
      <Copy variant="caption">
        Вэб дээр координатаа оруулна уу. Гар утасны апп дээр газрын зураг
        ашиглана.
      </Copy>
      <Input
        label="Өргөрөг"
        keyboardType="decimal-pad"
        value={value.lat?.toString() ?? ""}
        onChangeText={(raw) => onChange({ ...value, lat: coordinate(raw) })}
      />
      <Input
        label="Уртраг"
        keyboardType="decimal-pad"
        value={value.lng?.toString() ?? ""}
        onChangeText={(raw) => onChange({ ...value, lng: coordinate(raw) })}
      />
      {outside && <Banner error>Сонгосон байршил бүсээс гадна байна.</Banner>}
    </View>
  );
}
