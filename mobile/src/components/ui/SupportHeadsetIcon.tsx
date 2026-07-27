import { StyleSheet, View } from "react-native";

interface SupportHeadsetIconProps {
  size?: number;
  color?: string;
}

/**
 * Icon "nhân viên hỗ trợ đeo tai nghe" kiểu outline, vẽ thuần bằng
 * View/StyleSheet — không phụ thuộc thư viện icon hay ảnh ngoài.
 */
export function SupportHeadsetIcon({
  size = 72,
  color = "#22C55E",
}: SupportHeadsetIconProps) {
  const strokeWidth = size * 0.055;
  const bandWidth = size * 0.52;
  const bandHeight = size * 0.3;
  const cupSize = size * 0.16;
  const headSize = size * 0.34;
  const bodyWidth = size * 0.46;
  const bodyHeight = size * 0.22;

  return (
    <View
      style={[
        styles.outerCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
        },
      ]}
    >
      {/* Vòng tai nghe (band) */}
      <View
        style={[
          styles.band,
          {
            width: bandWidth,
            height: bandHeight,
            borderTopLeftRadius: bandWidth / 2,
            borderTopRightRadius: bandWidth / 2,
            borderWidth: strokeWidth * 0.85,
            borderBottomWidth: 0,
            borderColor: color,
            top: size * 0.16,
          },
        ]}
      />

      {/* Tai nghe trái */}
      <View
        style={[
          styles.cup,
          {
            width: cupSize,
            height: cupSize,
            borderRadius: cupSize / 2,
            backgroundColor: color,
            top: size * 0.4,
            left: size * 0.16,
          },
        ]}
      />

      {/* Tai nghe phải */}
      <View
        style={[
          styles.cup,
          {
            width: cupSize,
            height: cupSize,
            borderRadius: cupSize / 2,
            backgroundColor: color,
            top: size * 0.4,
            right: size * 0.16,
          },
        ]}
      />

      {/* Đầu người */}
      <View
        style={[
          styles.head,
          {
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            borderWidth: strokeWidth * 0.85,
            borderColor: color,
            top: size * 0.3,
          },
        ]}
      />

      {/* Thân người */}
      <View
        style={[
          styles.body,
          {
            width: bodyWidth,
            height: bodyHeight,
            borderTopLeftRadius: bodyWidth / 2,
            borderTopRightRadius: bodyWidth / 2,
            borderWidth: strokeWidth * 0.85,
            borderBottomWidth: 0,
            borderColor: color,
            bottom: size * 0.1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  band: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  cup: {
    position: "absolute",
  },
  head: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  body: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});