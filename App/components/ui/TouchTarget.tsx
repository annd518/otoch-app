import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
// Legacy flow actions share the same minimum target while retaining their logic.
export function TouchTarget({ style, ...props }: TouchableOpacityProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      {...props}
      style={[{ minWidth: 48, minHeight: 48, justifyContent: "center" }, style]}
    />
  );
}
