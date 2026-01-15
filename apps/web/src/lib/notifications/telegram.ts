const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Telegram is not configured.');
  }
  return { token, chatId };
};

export const sendTelegramMessage = async (text: string) => {
  const { token, chatId } = getTelegramConfig();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).description === 'string'
        ? ((payload as Record<string, unknown>).description as string)
        : 'Telegram request failed.';
    const error = new Error(errorMessage);
    (error as Error & { responseJson?: unknown }).responseJson = payload;
    throw error;
  }
  const messageId =
    payload && typeof payload === 'object' && (payload as Record<string, unknown>).result
      ? ((payload as Record<string, unknown>).result as Record<string, unknown>).message_id
      : undefined;
  return { messageId: typeof messageId === 'number' ? String(messageId) : undefined, responseJson: payload };
};
