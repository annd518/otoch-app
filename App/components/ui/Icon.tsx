import { View } from "react-native";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CircleCheck,
  CreditCard,
  FileImage,
  Images,
  PencilLine,
  Phone,
  Stethoscope,
} from "lucide-react-native";
export function Icon({
  name,
  size = 24,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const icons: Record<string, typeof ArrowLeft> = {
    "chevron-back": ArrowLeft,
    "alert-circle-outline": AlertCircle,
    "camera-outline": Camera,
    "images-outline": Images,
    "create-outline": PencilLine,
    "document-outline": FileImage,
    "card-outline": CreditCard,
    "checkmark-circle": CircleCheck,
    call: Phone,
    medkit: Stethoscope,
  };
  const Component = icons[name] ?? AlertCircle;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Component size={size} color={color} strokeWidth={2} />
    </View>
  );
}
