import { Redirect, useLocalSearchParams } from "expo-router";
export default function PatientProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/patients/edit", params: { id } }} />;
}
