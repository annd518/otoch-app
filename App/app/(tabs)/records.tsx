import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import type { ClinicalRecord } from "@/services/clientV2";
import { Button, Card, Copy, Screen, StateView } from "@/components/ui";
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
            <Copy variant="heading">{r.patientName}</Copy>
            <Copy>
              {new Date(r.at).toLocaleString("mn-MN", {
                timeZone: "Asia/Ulaanbaatar",
              })}
            </Copy>
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
