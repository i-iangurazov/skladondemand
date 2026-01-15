'use client';

import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/useLanguage';
import type { Language } from '@/lib/i18n';

export default function LanguageSelect() {
  const { lang, setLang } = useLanguage();
  const t = useTranslations('common.language');

  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">{t('label')}</span>
      <Select value={lang} onValueChange={(value) => setLang(value as Language)}>
        <SelectTrigger className="h-11 min-w-[78px] rounded-full border-[#432587]/20 bg-white px-3 text-sm font-semibold text-[#432587] shadow-sm">
          <SelectValue aria-label={t('label')} />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="en">{t('options.en')}</SelectItem>
          <SelectItem value="ru">{t('options.ru')}</SelectItem>
          <SelectItem value="kg">{t('options.kg')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
