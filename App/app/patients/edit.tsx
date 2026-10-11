import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import { Banner, Button, Chip, Input, Screen } from "@/components/ui";
import { useSingleFlight } from "@/components/useSingleFlight";
export default function PatientForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState(""),
    [birthYear, setYear] = useState(""),
    [gender, setGender] = useState("Other"),
    [address, setAddress] = useState(""),
    [phone, setPhone] = useState(""),
    [representative, setRepresentative] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    void apiService.getParent(id).then((r) => {
      if (!active) return;
      if (!r.ok) {
        setError(r.message);
        return;
      }
      const p = r.data;
      setName(p.name);
      setYear(p.birthYear?.toString() ?? "");
      setGender(p.gender);
      setAddress(p.address);
      setPhone(p.emergencyContact);
      setRepresentative(p.needsRepresentative ?? false);
    });
    return () => {
      active = false;
    };
  }, [id]);
  const save = useSingleFlight(async () => {
    const year = Number(birthYear),
      current = new Date().getFullYear();
    if (
      !name.trim() ||
      !/^\d{4}$/.test(birthYear) ||
      year < 1900 ||
      year > current ||
      address.trim().length < 5 ||
      !/^(\+976)?\d{8}$/.test(phone)
    ) {
      setError("Нэр, төрсөн он, хаяг, 8 оронтой утсаа зөв бөглөнө үү.");
      return;
    }
    const body = {
      name: name.trim(),
      birthYear: year,
      age: Math.max(1, current - year),
      gender,
      address: address.trim(),
      emergencyContact: phone,
      needsRepresentative: representative,
    };
    const r = id
      ? await apiService.updateParent(id, body)
      : await apiService.createParent(body);
    if (r.ok) router.back();
    else setError(r.message);
  });
  return (
    <Screen title={id ? "Үйлчлүүлэгчийн мэдээлэл" : "Үйлчлүүлэгч нэмэх"}>
      {!!error && <Banner error>{error}</Banner>}
      <Input label="Нэр" value={name} onChangeText={setName} />
      <Input
        label="Төрсөн он"
        value={birthYear}
        onChangeText={setYear}
        keyboardType="number-pad"
        maxLength={4}
      />
      {[
        ["Female", "Эмэгтэй"],
        ["Male", "Эрэгтэй"],
        ["Other", "Бусад"],
      ].map(([value, label]) => (
        <Chip
          key={value}
          label={label}
          selected={gender === value}
          onPress={() => setGender(value)}
        />
      ))}
      <Input label="Хаяг" value={address} onChangeText={setAddress} />
      <Input
        label="Яаралтай холбоо барих утас"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Chip
        label="Үйлчилгээ авахад төлөөлөл шаардлагатай"
        selected={representative}
        onPress={() => setRepresentative((v) => !v)}
      />
      <Button
        network
        title="Хадгалах"
        busy={save.running}
        onPress={() => {
          void save.run();
        }}
      />
    </Screen>
  );
}
