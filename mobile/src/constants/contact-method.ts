import type { ContactMethod } from "../types/ticket";

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Điện thoại",
  message: "Tin nhắn",
  email: "Email",
};

export const CONTACT_METHOD_OPTIONS: ContactMethod[] = ["phone", "message", "email"];

export function getContactMethodLabel(method?: string | null): string {
  if (method && method in CONTACT_METHOD_LABELS) {
    return CONTACT_METHOD_LABELS[method as ContactMethod];
  }
  return "Không xác định";
}
