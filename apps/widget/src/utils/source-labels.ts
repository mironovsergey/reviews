/**
 * Названия площадок для вывода.
 *
 * В макете предусмотрены фирменные логотипы, но их файлы в виджет не
 * добавлены, поэтому выводится название текстом. Коды, отсутствующие в
 * перечне, не выводятся.
 */
const SOURCE_LABELS: Readonly<Record<string, string>> = {
  yandex: 'Яндекс',
  'yandex-services': 'Яндекс.Услуги',
  'yandex-business': 'Яндекс.Бизнес',
  google: 'Google',
  '2gis': '2ГИС',
  zoon: 'Zoon',
  yell: 'Yell',
  myreviews: 'MyReviews',
  prodoctorov: 'ПроДокторов',
  'prodoctorov-doctors': 'ПроДокторов',
  flamp: 'Flamp',
  otzovik: 'Отзовик',
  avito: 'Авито',
  'na-popravku': 'НаПоправку',
  sberzdorovie: 'СберЗдоровье',
  tbank: 'Т-Банк',
  vk: 'ВКонтакте',
  trustpilot: 'Trustpilot',
  irecommend: 'IRecommend',
};

export const getSourceLabel = (source: string): string | null => {
  return SOURCE_LABELS[source] ?? null;
};
