import { theme } from "@/design/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SelectedService } from "@/services/bookingDraft";
import type { Quote } from "@/services/apiTypes";
import { formatMnt } from "@/utils/money";

const EXCLUDE_LABELS: Record<string, string> = {
  TRAVEL_FEE: "унааны зардал",
  DISCOUNT: "хөнгөлөлт",
  VAT: "НӨАТ",
};

// Shows the server quote when one exists (lines + quote.totalMnt). Without a
// quote it shows only the catalog display price and never adds anything up.
export function PriceSummary({
  service,
  quote,
}: {
  service: SelectedService | null;
  quote: Quote | null;
}) {
  if (quote) {
    return (
      <View style={styles.card}>
        {quote.lines.map((line, index) => (
          <View
            key={`${line.code ?? line.serviceId ?? "line"}-${index}`}
            style={styles.row}
          >
            <Text style={styles.label}>{line.name}</Text>
            <Text style={[styles.value, line.amountMnt < 0 && styles.discount]}>
              {formatMnt(line.amountMnt)}
            </Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.total}>Нийт төлөх:</Text>
          <Text style={styles.total}>{formatMnt(quote.totalMnt)}</Text>
        </View>
        {quote.excludes.length > 0 ? (
          <Text style={styles.note}>
            Ороогүй:{" "}
            {quote.excludes.map((e) => EXCLUDE_LABELS[e] ?? e).join(", ")}.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Үйлчилгээний урьдчилсан үнэ:</Text>
        <Text style={styles.value}>
          {service ? formatMnt(service.priceMnt) : "-"}
        </Text>
      </View>
      <Text style={styles.note}>
        Унааны зардал, хөнгөлөлт болон эцсийн төлөх дүнг сервер тооцно. QPay
        төлбөр дараагийн алхамд нэмэгдэнэ.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.background,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.color.info,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
  },
  value: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "600",
    color: theme.color.text,
  },
  discount: { color: theme.color.secondary },
  divider: { height: 1, backgroundColor: theme.color.info, marginVertical: 8 },
  total: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "800",
    color: theme.color.text,
  },
  note: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
    lineHeight: 28,
  },
});
