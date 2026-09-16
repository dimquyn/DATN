function mapTicketData(id: string, data: DocumentData): Ticket {
  return {
    id,
    code: data.code ?? null,
    customerName: data.customerName,
    phone: data.phone,
    email: data.email,
    content: data.content,
    channel: data.channel,
    status: data.status,
    assignedTo: data.assignedTo ?? null,
    aiResultId: data.aiResultId ?? null,
    finalReply: data.finalReply ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastAIError: data.lastAIError,
  };
}