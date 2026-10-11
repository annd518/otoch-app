import { Screen, StateView } from "@/components/ui";
export default function Notifications() {
  return (
    <Screen title="Мэдэгдэл">
      <StateView
        title="Мэдэгдэл алга"
        message="Мэдэгдлийн үйлчилгээ хараахан холбогдоогүй байна. Захиалгын шинэ төлөвийг Захиалга хэсгээс харна уу."
      />
    </Screen>
  );
}
