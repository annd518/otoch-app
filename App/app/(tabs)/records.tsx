import { dateTimeLabel } from "@/design/dateLabels";
import { FileHeart, FileText } from "lucide-react-native";
import {
  FeatureSummary,
  SectionHeading,
  Button,
  Card,
  Copy,
  Screen,
  StateView,
} from "@/components/ui";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import type { ClinicalRecord } from "@/services/clientV2";
export default function Records() {
  const openPdf = async (id: string) => {
    const r = await apiService.getRecordPdf(id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (await Sharing.isAvailableAsync())
      await Sharing.shareAsync(r.data, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    else setError("Энэ орчинд PDF нээх боломжгүй байна.");
  };

  const [rows, setRows] = useState<ClinicalRecord[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const r = await apiService.records();
    setLoading(false);
    if (r.ok) {
      setRows(r.data);
      setError("");
    } else setError(r.message);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen title="Тэмдэглэл" back={false}>
      <FeatureSummary
        compact
        icon={FileHeart}
        title="Таны үйлчилгээний тэмдэглэл"
        description="Серверт бүртгэгдсэн тэмдэглэл, боломжтой PDF тайланг эндээс нээнэ."
      />
      {loading ? (
        <StateView title="Тэмдэглэл ачаалж байна" loading />
      ) : error ? (
        <StateView
          title="Ачаалж чадсангүй"
          message={error}
          action="Дахин оролдох"
          onAction={() => {
            void load();
          }}
        />
      ) : rows.length ? (
        rows.map((r) => (
          <Card key={r.id}>
            <SectionHeading icon={FileText} title={r.patientName} />
            <Copy>{dateTimeLabel(r.at)}</Copy>
            <Copy>{r.notes ?? "Бичгэн тэмдэглэл ороогүй байна."}</Copy>
            {r.pdfAvailable ? (
              <Button
                secondary
                title="PDF нээх / хадгалах"
                onPress={() => {
                  void openPdf(r.id);
                }}
              />
            ) : (
              <Copy>PDF хувилбар хараахан бэлэн болоогүй.</Copy>
            )}
          </Card>
        ))
      ) : (
        <StateView
          title="Тэмдэглэл алга"
          message="Үйлчилгээний дараа баталгаажсан тэмдэглэл энд харагдана."
        />
      )}
    </Screen>
  );
}
