const E164_REGEX = /^\+\d{8,15}$/;

export const normalizeE164 = (value: string) => {
  const trimmed = value.trim();
  return E164_REGEX.test(trimmed) ? trimmed : null;
};

export const toDigitsOnly = (value: string) => value.replace(/\D/g, '');

export const toWhatsAppRecipient = (value: string) => {
  const normalized = normalizeE164(value);
  if (!normalized) return null;
  return toDigitsOnly(normalized);
};

const getWhatsAppApiUrl = () => {
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured.');
  }
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
};

const getWhatsAppToken = () => {
  const token = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
  if (!token) {
    throw new Error('WHATSAPP_BUSINESS_ACCESS_TOKEN is not configured.');
  }
  return token;
};

const parseWhatsAppError = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return 'WhatsApp request failed.';
  const error = (payload as Record<string, unknown>).error as Record<string, unknown> | undefined;
  if (!error) return 'WhatsApp request failed.';
  const message = typeof error.message === 'string' ? error.message : null;
  const details =
    error.error_data && typeof error.error_data === 'object' && typeof (error.error_data as Record<string, unknown>).details === 'string'
      ? (error.error_data as Record<string, unknown>).details
      : null;
  return message || details || 'WhatsApp request failed.';
};

export const isTemplateRequiredError = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return false;
  const error = (payload as Record<string, unknown>).error as Record<string, unknown> | undefined;
  if (!error) return false;
  const code = typeof error.code === 'number' ? error.code : undefined;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const details =
    error.error_data && typeof error.error_data === 'object' && typeof (error.error_data as Record<string, unknown>).details === 'string'
      ? (error.error_data as Record<string, unknown>).details.toLowerCase()
      : '';
  return code === 131047 || message.includes('template') || details.includes('template') || message.includes('24');
};

type WhatsAppTemplatePayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: Array<{ type: 'body'; parameters: Array<{ type: 'text'; text: string }> }>;
  };
};

type WhatsAppTextPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
};

export const buildWhatsAppTemplatePayload = (input: {
  to: string;
  templateName: string;
  lang: string;
  components?: WhatsAppTemplatePayload['template']['components'];
}): WhatsAppTemplatePayload => ({
  messaging_product: 'whatsapp',
  to: input.to,
  type: 'template',
  template: {
    name: input.templateName,
    language: { code: input.lang },
    components: input.components,
  },
});

export const buildWhatsAppTextPayload = (input: { to: string; text: string }): WhatsAppTextPayload => ({
  messaging_product: 'whatsapp',
  to: input.to,
  type: 'text',
  text: { body: input.text },
});

const postWhatsApp = async (body: WhatsAppTemplatePayload | WhatsAppTextPayload) => {
  const response = await fetch(getWhatsAppApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getWhatsAppToken()}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(parseWhatsAppError(payload));
    (error as Error & { responseJson?: unknown }).responseJson = payload;
    throw error;
  }
  return payload;
};

export const sendWhatsAppTemplate = async (input: {
  toE164: string;
  templateName: string;
  lang: string;
  components?: WhatsAppTemplatePayload['template']['components'];
}) => {
  const toDigits = toWhatsAppRecipient(input.toE164);
  if (!toDigits) {
    throw new Error('Invalid WhatsApp recipient.');
  }
  const payload = await postWhatsApp(
    buildWhatsAppTemplatePayload({
      to: toDigits,
      templateName: input.templateName,
      lang: input.lang,
      components: input.components,
    })
  );
  const messageId =
    payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).messages)
      ? ((payload as Record<string, unknown>).messages as Array<{ id?: string }>)[0]?.id
      : undefined;
  return { messageId, responseJson: payload };
};

export const sendWhatsAppText = async (input: { toE164: string; text: string }) => {
  const toDigits = toWhatsAppRecipient(input.toE164);
  if (!toDigits) {
    throw new Error('Invalid WhatsApp recipient.');
  }
  const payload = await postWhatsApp(buildWhatsAppTextPayload({ to: toDigits, text: input.text }));
  const messageId =
    payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).messages)
      ? ((payload as Record<string, unknown>).messages as Array<{ id?: string }>)[0]?.id
      : undefined;
  return { messageId, responseJson: payload };
};

export const sendWhatsAppWithFallback = async (input: {
  mode: 'template' | 'text';
  toE164: string;
  text: string;
  templateName: string;
  templateLang: string;
  components?: WhatsAppTemplatePayload['template']['components'];
}) => {
  if (input.mode === 'text') {
    try {
      return await sendWhatsAppText({ toE164: input.toE164, text: input.text });
    } catch (error) {
      const responseJson = (error as Error & { responseJson?: unknown }).responseJson;
      if (isTemplateRequiredError(responseJson)) {
        return await sendWhatsAppTemplate({
          toE164: input.toE164,
          templateName: input.templateName,
          lang: input.templateLang,
          components: input.components,
        });
      }
      throw error;
    }
  }

  return await sendWhatsAppTemplate({
    toE164: input.toE164,
    templateName: input.templateName,
    lang: input.templateLang,
    components: input.components,
  });
};
