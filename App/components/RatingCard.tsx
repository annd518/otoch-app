// Rating a finished visit (spec SCR-C16): 1-5 stars, chips, optional comment.
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Star } from "lucide-react-native";
import { Banner, Button, Card, Chip, Copy, Input, SectionHeading } from "@/components/ui";
import { theme as t } from "@/design/theme";
import { RATING_TAGS } from "@/services/orders";
import type { ApiResult } from "@/services/apiResult";
import type { Order, OrderRating, RatingTag } from "@/services/apiTypes";

const GOLD = "#E8A317";
const STAR_WORDS = ["", "Муу", "Дунд зэрэг", "Хэвийн", "Сайн", "Маш сайн"];

function Stars({ value, onChange, size = 40 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole={onChange ? "adjustable" : "text"} accessibilityLabel={`${value} од`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star size={size} color={GOLD} fill={n <= value ? GOLD : "transparent"} />;
        return onChange ? (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} од`}
            hitSlop={6}
            onPress={() => onChange(n)}
            style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}
          >
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

/** The customer's own rating once given. */
export function GivenRating({ rating }: { rating: OrderRating }) {
  const labels = rating.tags.map((c) => RATING_TAGS.find((x) => x.code === c)?.label ?? c);
  return (
    <Card>
      <SectionHeading icon={Star} title="Таны үнэлгээ" />
      <Stars value={rating.stars} size={28} />
      {labels.length > 0 && <Copy>{labels.join(" · ")}</Copy>}
      {!!rating.comment && <Copy variant="caption">“{rating.comment}”</Copy>}
    </Card>
  );
}

export function RatingCard({
  order,
  onRated,
  submit,
}: {
  order: Order;
  onRated: (order: Order) => void;
  submit: (rating: { stars: number; tags: RatingTag[]; comment?: string }) => Promise<ApiResult<Order>>;
}) {
  const [stars, setStars] = useState(0),
    [tags, setTags] = useState<RatingTag[]>([]),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [later, setLater] = useState(false);
  if (later)
    return (
      <Button variant="ghost" title="Үйлчилгээг үнэлэх" onPress={() => setLater(false)} />
    );
  const send = async () => {
    if (stars === 0 || busy) return;
    setBusy(true);
    setError("");
    const r = await submit({ stars, tags, comment });
    setBusy(false);
    if (r.ok) onRated(r.data);
    else setError(r.message);
  };
  return (
    <Card>
      <SectionHeading icon={Star} title="Үйлчилгээг үнэлэх" />
      <Copy>
        {order.nurse?.name ? `Сувилагч: ${order.nurse.name}. ` : ""}Үйлчилгээ танд хэр таалагдсан бэ?
      </Copy>
      <Stars value={stars} onChange={setStars} />
      {stars > 0 && <Copy variant="label">{STAR_WORDS[stars]}</Copy>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
        {RATING_TAGS.map((tag) => (
          <Chip
            key={tag.code}
            label={tag.label}
            selected={tags.includes(tag.code)}
            style={{ minWidth: 120 }}
            onPress={() =>
              setTags((cur) => (cur.includes(tag.code) ? cur.filter((c) => c !== tag.code) : [...cur, tag.code]))
            }
          />
        ))}
      </View>
      <Input
        label="Сэтгэгдэл (заавал биш)"
        value={comment}
        onChangeText={setComment}
        maxLength={1000}
        multiline
        placeholder="Юу таалагдсан, юуг сайжруулах вэ?"
      />
      {!!error && <Banner error>{error}</Banner>}
      <Button title="Илгээх" network busy={busy} disabled={stars === 0} onPress={() => void send()} />
      <Button variant="ghost" title="Дараа үнэлэх" onPress={() => setLater(true)} />
    </Card>
  );
}
