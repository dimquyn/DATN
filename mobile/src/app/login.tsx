import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { getAuthErrorMessage } from "../utils/firebase-auth-error";
import { FullScreenLoading } from "../components/common/FullScreenLoading";
import { SupportHeadsetIcon } from "../components/ui/SupportHeadsetIcon";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 6;

interface FieldErrors {
  email?: string;
  password?: string;
}

function validateEmail(rawEmail: string): string | undefined {
  const email = rawEmail.trim();

  if (email.length === 0) {
    return "Vui lòng nhập email.";
  }

  if (email.length > MAX_FIELD_LENGTH) {
    return "Email không được vượt quá 100 ký tự.";
  }

  if (!EMAIL_REGEX.test(email)) {
    return "Email không đúng định dạng.";
  }

  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (password.length === 0) {
    return "Vui lòng nhập mật khẩu.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Mật khẩu phải có ít nhất 6 ký tự.";
  }

  if (password.length > MAX_FIELD_LENGTH) {
    return "Mật khẩu không được vượt quá 100 ký tự.";
  }

  return undefined;
}

export default function LoginScreen() {
  const { user, initializing, login } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (user) {
    return <Redirect href="/dashboard" />;
  }

  const handleEmailChange = (value: string): void => {
    setEmail(value);

    if (formError) {
      setFormError(null);
    }

    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (value: string): void => {
    setPassword(value);

    if (formError) {
      setFormError(null);
    }

    if (fieldErrors.password) {
      setFieldErrors((prev) => ({
        ...prev,
        password: validatePassword(value),
      }));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (submitting) {
      return;
    }

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setFieldErrors({ email: emailError, password: passwordError });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Đăng nhập</Text>

        <View style={styles.iconWrapper}>
          <SupportHeadsetIcon />
        </View>

        <Text style={styles.description}>
          Đăng nhập để tiếp nhận và xử lý khiếu nại khách hàng.
        </Text>

        {formError !== null && (
          <View style={styles.formErrorBox}>
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={handleEmailChange}
            placeholder="ten@congty.vn"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            editable={!submitting}
            style={[styles.input, fieldErrors.email ? styles.inputError : null]}
          />
          {fieldErrors.email && (
            <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="Nhập mật khẩu"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              editable={!submitting}
              style={[
                styles.input,
                styles.passwordInput,
                fieldErrors.password ? styles.inputError : null,
              ]}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              disabled={submitting}
              style={styles.toggleButton}
              hitSlop={8}
            >
              <Text style={styles.toggleButtonText}>
                {showPassword ? "Ẩn" : "Hiện"}
              </Text>
            </Pressable>
          </View>
          {fieldErrors.password && (
            <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
          )}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[
            styles.submitButton,
            submitting ? styles.submitButtonDisabled : null,
          ]}
        >
          {submitting ? (
            <View style={styles.submitLoadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Đang đăng nhập...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Đăng nhập</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  iconWrapper: {
    marginTop: 16,
    alignItems: "center",
  },
  description: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
  },
  formErrorBox: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  formErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    marginTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  toggleButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1667B1",
  },
  fieldErrorText: {
    marginTop: 6,
    fontSize: 12,
    color: "#DC2626",
  },
  submitButton: {
    marginTop: 28,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#1667B1",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#93B8DA",
  },
  submitLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});