import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { TrackedTicket } from "../types/ticket-tracking";

interface TrackTicketResponse {
  ticket: TrackedTicket;
}

export async function trackTicket(code: string, phone: string): Promise<TrackedTicket> {
  const callable = httpsCallable<{ code: string; phone: string }, TrackTicketResponse>(
    functions,
    "trackTicket"
  );
  const result = await callable({ code: code.trim().toUpperCase(), phone });
  return result.data.ticket;
}

export interface SubmitRatingParams {
  code: string;
  phone: string;
  rating: number;
  comment: string;
}

export async function submitTicketRating(params: SubmitRatingParams): Promise<void> {
  const callable = httpsCallable<SubmitRatingParams, { success: boolean }>(
    functions,
    "submitTicketRating"
  );
  await callable(params);
}
