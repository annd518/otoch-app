import React from "react"
import { StyleSheet, Text, View } from "react-native"

import type { SelectedService } from "@/context/BookingDraftContext"
import type { Quote } from "@/services/apiTypes"
import { formatMnt } from "@/utils/money"

// Shows the server quote when one exists (lines + quote.totalMnt). Without a
// quote it shows only the catalog display price and never adds anything up.
export function PriceSummary({ service, quote }: { service: SelectedService | null; quote: Quote | null }) {
  if (quote) {
    return (
      <View style={styles.card}>
        {quote.lines.map((line, index) => (
          <View key={`${line.code ?? line.serviceId ?? "line"}-${index}`} style={styles.row}>
            <Text style={styles.label}>{line.name}</Text>
            <Text style={[styles.value, line.amountMnt < 0 && styles.discount]}>{formatMnt(line.amountMnt)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.total}>Нийт төлөх:</Text>
          <Text style={styles.total}>{formatMnt(quote.totalMnt)}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Үйлчилгээний урьдчилсан үнэ:</Text>
        <Text style={styles.value}>{service ? formatMnt(service.priceMnt) : "-"}</Text>
      </View>
      <Text style={styles.note}>
        Унааны зардал, хөнгөлөлт болон эцсийн төлөх дүнг сервер тооцно. QPay төлбөр дараагийн алхамд нэмэгдэнэ.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 },
  label: { flex: 1, fontSize: 15, color: "#666" },
  value: { fontSize: 15, fontWeight: "600", color: "#111" },
  discount: { color: "#4caf50" },
  divider: { height: 1, backgroundColor: "#e1e4e8", marginVertical: 8 },
  total: { fontSize: 18, fontWeight: "800", color: "#111" },
  note: { fontSize: 13, color: "#888", lineHeight: 18 },
})
