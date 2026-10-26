// Earnings (spec SCR-N11): the week's or month's total, a bar per day, the
// visits, transfers already made and the bank account they go to.
import { ChevronLeft, ChevronRight, Landmark, Wallet } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { ErrorBox } from "../../components/ErrorBox";
import { Field } from "../../components/Field";
import { BrandHeader, FormSection, Intro, Surface } from "../../components/Presentation";
import { EmptyState, Skeleton } from "../../components/ScreenState";
import { theme } from "../../design/theme";
import { http } from "../../services/http";
import {
  BANKS,
  getEarnings,
  periodLabel,
  saveBank,
  weekdayShort,
  type BankAccount,
  type Earnings,
  type EarningsRangeKind,
} from "../../services/earnings";
import { formatMnt } from "../../utils/money";
import { formatUbDate, formatUbDateTime, ratingText } from "../../utils/orderView";

const BAR_HEIGHT = 120;

function Bars({ days, range }: { days: Earnings["days"]; range: EarningsRangeKind }) {
  const max = Math.max(1, ...days.map((d) => d.netMnt));
  return (
    <View
      accessibilityLabel="Өдөр бүрийн орлого"
      style={{ flexDirection: "row", alignItems: "flex-end", gap: range === "week" ? 10 : 2, height: BAR_HEIGHT + 24 }}
    >
      {days.map((d) => (
        <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: "100%",
              height: Math.max(4, Math.round((d.netMnt / max) * BAR_HEIGHT)),
              borderRadius: range === "week" ? 8 : 3,
              backgroundColor: d.netMnt > 0 ? theme.color.brand : theme.color.info,
            }}
          />
          {range === "week" && (
            <AppText variant="caption" color={theme.color.secondary}>
              {weekdayShort(d.date)}
            </AppText>
          )}
        </View>
      ))}
    </View>
  );
}

function BankForm({ initial, onSaved }: { initial: BankAccount | null; onSaved: (b: BankAccount) => void }) {
  const [bankName, setBankName] = useState(initial?.bankName ?? ""),
    [accountNo, setAccountNo] = useState(initial?.accountNo ?? ""),
    [accountName, setAccountName] = useState(initial?.accountName ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await saveBank(http, { bankName, accountNo, accountName });
    setBusy(false);
    if (r.ok) onSaved(r.data);
    else setError(r.fields ? Object.values(r.fields).join(". ") : r.message);
  };
  return (
    <View style={{ gap: theme.space[3] }}>
      <AppText variant="label">Банк</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space[1] }}>
        {BANKS.map((b) => (
          <Pressable
            key={b}
            accessibilityRole="button"
            accessibilityState={{ selected: bankName === b }}
            onPress={() => setBankName(b)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 14,
              borderRadius: theme.radius.round,
              borderWidth: 1,
              borderColor: bankName === b ? theme.color.brand : theme.color.border,
              backgroundColor: bankName === b ? theme.color.info : theme.color.surface,
            }}
          >
            <AppText variant="caption" color={bankName === b ? theme.color.brand : theme.color.text}>
              {b}
            </AppText>
          </Pressable>
        ))}
      </View>
      <Field
        label="Дансны дугаар"
        value={accountNo}
        onChangeText={setAccountNo}
        keyboardType="default"
        autoCapitalize="characters"
        placeholder="5000123456 эсвэл MN.."
      />
      <Field label="Данс эзэмшигчийн нэр" value={accountName} onChangeText={setAccountName} />
      {error ? <ErrorBox message={error} /> : null}
      <Button
        label="Хадгалах"
        loading={busy}
        disabled={!bankName || accountNo.trim().length < 6 || accountName.trim().length < 2}
        onPress={() => void save()}
      />
    </View>
  );
}

export default function EarningsScreen() {
  const [range, setRange] = useState<EarningsRangeKind>("week"),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<Earnings | null>(null),
    [error, setError] = useState<string | null>(null),
    [editBank, setEditBank] = useState(false);

  const load = useCallback(async () => {
    const r = await getEarnings(http, range, offset);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else setError(r.message);
  }, [range, offset]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const choose = (next: EarningsRangeKind) => {
    setRange(next);
    setOffset(0);
    setData(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        <BrandHeader />
        <Intro title="Орлого" icon={Wallet} description={`Үйлчилгээний үнийн ${data?.sharePercent ?? 70}% танд олгогдоно.`} />

        <View style={{ flexDirection: "row", gap: theme.space[1] }}>
          {(["week", "month"] as const).map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: range === r }}
              onPress={() => choose(r)}
              style={{
                flex: 1,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: theme.radius.round,
                backgroundColor: range === r ? theme.color.brand : theme.color.surface,
                borderWidth: 1,
                borderColor: range === r ? theme.color.brand : theme.color.border,
              }}
            >
              <AppText variant="label" color={range === r ? theme.color.onBrand : theme.color.text}>
                {r === "week" ? "7 хоног" : "Сар"}
              </AppText>
            </Pressable>
          ))}
        </View>

        {error ? <ErrorBox message={error} /> : null}
        {!data ? (
          <Skeleton rows={2} />
        ) : (
          <>
            <View
              style={{
                backgroundColor: theme.color.navy,
                borderRadius: theme.radius.card,
                padding: 20,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Өмнөх"
                  hitSlop={8}
                  onPress={() => setOffset((o) => o + 1)}
                  style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
                >
                  <ChevronLeft color={theme.color.onBrand} />
                </Pressable>
                <AppText variant="caption" color={theme.color.onBrand}>
                  {periodLabel(data)}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Дараах"
                  hitSlop={8}
                  disabled={offset === 0}
                  onPress={() => setOffset((o) => Math.max(0, o - 1))}
                  style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "flex-end", opacity: offset === 0 ? 0.3 : 1 }}
                >
                  <ChevronRight color={theme.color.onBrand} />
                </Pressable>
              </View>
              <AppText variant="title" color={theme.color.onBrand}>
                {formatMnt(data.totals.netMnt)}
              </AppText>
              <AppText variant="caption" color={theme.color.onBrand}>
                {data.totals.visits} эргэлт · {ratingText(data.rating)}
              </AppText>
            </View>

            <Surface>
              <AppText variant="label">
                Шилжүүлэгдээгүй: {formatMnt(data.unpaid.netMnt)}
              </AppText>
              <AppText variant="caption" color={theme.color.secondary}>
                {data.unpaid.visits > 0
                  ? `${data.unpaid.visits} эргэлтийн орлого. Компани таны дансанд шилжүүлнэ.`
                  : "Бүх орлого шилжүүлэгдсэн."}
                {data.payouts[0] ? ` Сүүлийн шилжүүлэг: ${formatUbDate(data.payouts[0].paidAt) ?? ""}, ${formatMnt(data.payouts[0].totalMnt)}.` : ""}
              </AppText>
              {!data.bank && (
                <AppText variant="caption" color={theme.color.warning}>
                  Дансны мэдээллээ оруулаагүй тул шилжүүлэг хийгдэхгүй. Доороос оруулна уу.
                </AppText>
              )}
            </Surface>

            <Bars days={data.days} range={data.range} />

            <FormSection title={data.range === "week" ? "Энэ үеийн эргэлтүүд" : "Сарын эргэлтүүд"}>
              {data.entries.length === 0 ? (
                <EmptyState title="Эргэлт алга" hint="Дууссан үйлчилгээ энд харагдана." />
              ) : (
                data.entries.map((e) => (
                  <View
                    key={e.orderId}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.color.border,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="label">{e.services.join(", ") || "Үйлчилгээ"}</AppText>
                      <AppText variant="caption" color={theme.color.secondary}>
                        {formatUbDateTime(e.earnedAt) ?? ""}
                        {e.paidAt ? " · шилжүүлсэн" : " · хүлээгдэж буй"}
                      </AppText>
                    </View>
                    <AppText variant="label" color={theme.color.success}>
                      +{formatMnt(e.netMnt)}
                    </AppText>
                  </View>
                ))
              )}
            </FormSection>

            {data.payouts.length > 0 && (
              <FormSection title="Шилжүүлгүүд">
                {data.payouts.map((p) => (
                  <AppText key={p.id} variant="caption">
                    {formatUbDate(p.paidAt) ?? ""} · {formatMnt(p.totalMnt)} · {p.visits} эргэлт
                  </AppText>
                ))}
              </FormSection>
            )}

            <FormSection title="Дансны мэдээлэл">
              {data.bank && !editBank ? (
                <>
                  <Intro
                    title={data.bank.bankName}
                    icon={Landmark}
                    description={`${data.bank.accountNo} · ${data.bank.accountName}`}
                  />
                  <Button label="Данс өөрчлөх" variant="secondary" onPress={() => setEditBank(true)} />
                </>
              ) : (
                <>
                  <BankForm
                    initial={data.bank}
                    onSaved={(bank) => {
                      setData({ ...data, bank });
                      setEditBank(false);
                    }}
                  />
                  {data.bank && <Button label="Болих" variant="secondary" onPress={() => setEditBank(false)} />}
                </>
              )}
            </FormSection>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
