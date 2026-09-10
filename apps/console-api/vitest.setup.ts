import { Logger } from '@nestjs/common';

// Журнал приложения в выводе тестов не нужен: он скрывает результаты
// проверок, а сами сообщения проверяются отдельно.
Logger.overrideLogger(false);
