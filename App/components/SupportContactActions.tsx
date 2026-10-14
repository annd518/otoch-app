import React, { useState } from "react";
import { Linking, View } from "react-native";

import { Button, Copy } from "@/components/ui";
import { supportContact } from "@/utils/env";
import { hasSupportContact } from "@/utils/supportContact";

// Call / open the owner-approved support channel. When none is configured it
// says so instead of inventing a contact (fallback text is optional).
export function SupportContactActions({
  fallback,
}: {
  fallback?: string;
}) {
  const [error, setError] = useState("");
  const open = (url: string) => {
    setError("");
    Linking.openURL(url).catch(() =>
      setError("Холбоосыг нээж чадсангүй. Дахин оролдоно уу."),
    );
  };
  if (!hasSupportContact(supportContact))
    return fallback ? <Copy variant="caption">{fallback}</Copy> : null;
  return (
    <View style={{ gap: 8, alignSelf: "stretch" }}>
      {supportContact.phone && (
        <Button
          secondary
          title={`Тусламж руу залгах (${supportContact.phone})`}
          onPress={() => open(`tel:${supportContact.phone}`)}
        />
      )}
      {supportContact.url && (
        <Button
          secondary
          title="Тусламжийн хуудас нээх"
          onPress={() => open(supportContact.url!)}
        />
      )}
      {!!error && <Copy variant="caption">{error}</Copy>}
    </View>
  );
}
