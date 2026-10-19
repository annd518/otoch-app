import { CalendarDays, ChevronRight, UserRound } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { theme } from "../design/theme";
import type { StaffOrder } from "../services/staffOrders";
import { formatSchedule, serviceSummary } from "../utils/orderView";
import { AppText } from "./AppText";
import { StatusBadge } from "./StatusBadge";

export function OrderCard({
  order,
  onPress,
}: {
  order: StaffOrder;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${serviceSummary(order)}, ${order.patientName}, ${formatSchedule(order)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        gap: theme.space[1],
        padding: 20,
        ...theme.depth.soft,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: "#FFFFFF",
        backgroundColor: pressed ? theme.color.subtle : theme.color.background,
      })}
    >
      <View
        style={{
          flexDirection: "column",
          justifyContent: "space-between",
          gap: theme.space[2],
        }}
      >
        <AppText variant="label" style={{ flexShrink: 1 }}>
          {serviceSummary(order)}
        </AppText>
        <StatusBadge status={order.status} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <CalendarDays size={17} color={theme.color.brand} />
        <AppText
          variant="caption"
          color={theme.color.secondary}
          style={{ flex: 1 }}
        >
          {formatSchedule(order)}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <UserRound size={17} color={theme.color.brand} />
        <AppText variant="label" style={{ flex: 1 }}>
          {order.patientName}
        </AppText>
        <ChevronRight size={20} color={theme.color.brand} />
      </View>
      {order.address ? (
        <AppText
          variant="caption"
          color={theme.color.secondary}
          numberOfLines={2}
        >
          {order.address.text}
        </AppText>
      ) : null}
    </Pressable>
  );
}
